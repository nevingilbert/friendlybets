-- FriendlyBets — schema on plain Postgres (Neon).
--
-- Ported from the Supabase version. What changed and why:
--
--   * There is no auth.uid() and no RLS. The app server is the only client, it
--     knows who is signed in from the Auth.js session, and it passes that user id
--     into every function as p_user_id. The checks that RLS and auth.uid() used to
--     make are now made inside the functions against that argument.
--   * profiles + auth.users collapse into one `users` table, keyed on the Google
--     subject. Ids are uuids so rows imported from Supabase keep their old ids,
--     and every lobby, membership and bet still points at the right person.
--   * Every write is still a function. The state machine below is the only way
--     to mutate a bet — that is what makes "accept" race-safe and keeps hosts
--     honest, and it does not depend on which client is calling.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.users (
  id           uuid primary key default gen_random_uuid(),
  google_sub   text unique,
  email        text,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create index users_email_idx on public.users (lower(email));

create table public.lobbies (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  name       text not null check (char_length(name) between 1 and 60),
  host_id    uuid not null references public.users (id) on delete cascade,
  status     text not null default 'OPEN' check (status in ('OPEN', 'LOCKED', 'ARCHIVED')),
  created_at timestamptz not null default now()
);

create table public.lobby_members (
  lobby_id  uuid not null references public.lobbies (id) on delete cascade,
  user_id   uuid not null references public.users (id) on delete cascade,
  role      text not null default 'MEMBER' check (role in ('HOST', 'MEMBER')),
  joined_at timestamptz not null default now(),
  primary key (lobby_id, user_id)
);

create table public.bets (
  id           uuid primary key default gen_random_uuid(),
  lobby_id     uuid not null references public.lobbies (id) on delete cascade,
  proposition  text not null check (char_length(proposition) between 1 and 280),
  stake        text not null check (char_length(stake) between 1 and 120),
  creator_id   uuid not null references public.users (id) on delete cascade,
  creator_side text not null check (creator_side in ('YES', 'NO')),
  acceptor_id  uuid references public.users (id) on delete set null,
  status       text not null default 'OPEN'
                 check (status in ('OPEN', 'ACCEPTED', 'RESOLVED', 'COMPLETED', 'CANCELLED')),
  outcome      text check (outcome in ('YES', 'NO')),
  winner_id    uuid references public.users (id) on delete set null,
  loser_id     uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  resolved_at  timestamptz,
  completed_at timestamptz
);

create index bets_lobby_created_idx on public.bets (lobby_id, created_at desc);
create index bets_lobby_status_idx  on public.bets (lobby_id, status);
create index lobby_members_user_idx on public.lobby_members (user_id);
create index lobbies_host_idx       on public.lobbies (host_id);

-- ---------------------------------------------------------------------------
-- Predicates
-- ---------------------------------------------------------------------------

create or replace function public.is_lobby_member(p_lobby_id uuid, p_user_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.lobby_members
    where lobby_id = p_lobby_id and user_id = p_user_id
  );
$$;

create or replace function public.is_lobby_host(p_lobby_id uuid, p_user_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.lobbies
    where id = p_lobby_id and host_id = p_user_id
  );
$$;

-- Ambiguous glyphs (0/O, 1/I) are excluded so codes survive being read aloud.
create or replace function public.generate_lobby_code()
returns text language plpgsql as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.lobbies where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Every function that acts for someone starts here. A null id means the server
-- called without a session, which is a bug, not a user mistake — but it must
-- still refuse rather than act as nobody.
create or replace function public.require_user(p_user_id uuid)
returns void language plpgsql stable as $$
begin
  if p_user_id is null or not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sign-in. Called by Auth.js on every Google sign-in.
--
-- Matched on the Google subject first, then on email, so a person whose row was
-- imported from Supabase (or whose subject was never recorded) is recognised
-- rather than duplicated. display_name is only set on the first sign-in: people
-- rename themselves, and the next sign-in must not undo that.
-- ---------------------------------------------------------------------------

create or replace function public.upsert_user(
  p_google_sub text, p_email text, p_name text, p_avatar_url text
) returns jsonb language plpgsql as $$
declare
  v_id uuid;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if coalesce(trim(p_google_sub), '') = '' then
    raise exception 'Google did not identify this account' using errcode = '22023';
  end if;

  select id into v_id from public.users where google_sub = p_google_sub;

  if v_id is null and v_email is not null then
    select id into v_id from public.users
     where lower(email) = v_email and google_sub is null
     order by created_at
     limit 1;
  end if;

  if v_id is null then
    insert into public.users (google_sub, email, display_name, avatar_url)
    values (
      p_google_sub,
      v_email,
      left(coalesce(
        nullif(trim(p_name), ''),
        nullif(split_part(coalesce(v_email, ''), '@', 1), ''),
        'Guest'
      ), 40),
      p_avatar_url
    )
    returning id into v_id;
  else
    update public.users
       set google_sub = p_google_sub,
           email      = coalesce(v_email, email),
           avatar_url = coalesce(p_avatar_url, avatar_url)
     where id = v_id;
  end if;

  return jsonb_build_object('user_id', v_id);
end;
$$;

create or replace function public.rename_user(p_user_id uuid, p_display_name text)
returns public.users language plpgsql as $$
declare
  v_user public.users;
begin
  perform public.require_user(p_user_id);
  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'Your name cannot be empty' using errcode = '22023';
  end if;

  update public.users
     set display_name = left(trim(p_display_name), 40)
   where id = p_user_id
  returning * into v_user;

  return v_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lobbies
-- ---------------------------------------------------------------------------

create or replace function public.create_lobby(p_user_id uuid, p_name text)
returns public.lobbies language plpgsql as $$
declare
  v_lobby public.lobbies;
begin
  perform public.require_user(p_user_id);
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Give your lobby a name' using errcode = '22023';
  end if;

  insert into public.lobbies (code, name, host_id)
  values (public.generate_lobby_code(), left(trim(p_name), 60), p_user_id)
  returning * into v_lobby;

  insert into public.lobby_members (lobby_id, user_id, role)
  values (v_lobby.id, p_user_id, 'HOST');

  return v_lobby;
end;
$$;

-- Callable signed-out, so an invite link can say "X invited you to Y" before sign-in.
create or replace function public.lobby_preview(p_code text)
returns table (id uuid, code text, name text, host_name text, member_count bigint, status text)
language sql stable as $$
  select l.id,
         l.code,
         l.name,
         u.display_name,
         (select count(*) from public.lobby_members m where m.lobby_id = l.id),
         l.status
  from public.lobbies l
  join public.users u on u.id = l.host_id
  where l.code = upper(trim(p_code));
$$;

create or replace function public.join_lobby(p_user_id uuid, p_code text)
returns public.lobbies language plpgsql as $$
declare
  v_lobby public.lobbies;
begin
  perform public.require_user(p_user_id);

  select * into v_lobby from public.lobbies where code = upper(trim(p_code));
  if not found then
    raise exception 'No lobby with that code' using errcode = 'P0002';
  end if;

  -- Already in? Joining again is a no-op so invite links stay idempotent.
  if public.is_lobby_member(v_lobby.id, p_user_id) then
    return v_lobby;
  end if;

  if v_lobby.status <> 'OPEN' then
    raise exception 'This lobby is closed to new players' using errcode = '22023';
  end if;

  insert into public.lobby_members (lobby_id, user_id, role)
  values (v_lobby.id, p_user_id, 'MEMBER')
  on conflict do nothing;

  return v_lobby;
end;
$$;

create or replace function public.leave_lobby(p_user_id uuid, p_lobby_id uuid)
returns void language plpgsql as $$
begin
  perform public.require_user(p_user_id);
  if public.is_lobby_host(p_lobby_id, p_user_id) then
    raise exception 'The host cannot leave. Close the lobby instead.' using errcode = '22023';
  end if;
  delete from public.lobby_members
  where lobby_id = p_lobby_id and user_id = p_user_id;
end;
$$;

create or replace function public.update_lobby(
  p_user_id uuid, p_lobby_id uuid, p_name text default null, p_status text default null
) returns public.lobbies language plpgsql as $$
declare
  v_lobby public.lobbies;
begin
  if not public.is_lobby_host(p_lobby_id, p_user_id) then
    raise exception 'Only the host can change this lobby' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('OPEN', 'LOCKED', 'ARCHIVED') then
    raise exception 'Unknown lobby status %', p_status using errcode = '22023';
  end if;

  update public.lobbies
     set name   = coalesce(nullif(left(trim(p_name), 60), ''), name),
         status = coalesce(p_status, status)
   where id = p_lobby_id
  returning * into v_lobby;

  return v_lobby;
end;
$$;

create or replace function public.remove_member(p_user_id uuid, p_lobby_id uuid, p_member_id uuid)
returns void language plpgsql as $$
begin
  if not public.is_lobby_host(p_lobby_id, p_user_id) then
    raise exception 'Only the host can remove players' using errcode = '42501';
  end if;
  if p_member_id = p_user_id then
    raise exception 'The host cannot remove themselves' using errcode = '22023';
  end if;
  delete from public.lobby_members
  where lobby_id = p_lobby_id and user_id = p_member_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bets — the lifecycle is OPEN -> ACCEPTED -> RESOLVED -> COMPLETED,
-- with CANCELLED reachable from OPEN only.
-- ---------------------------------------------------------------------------

create or replace function public.create_bet(
  p_user_id uuid, p_lobby_id uuid, p_proposition text, p_stake text, p_creator_side text
) returns public.bets language plpgsql as $$
declare
  v_bet public.bets;
  v_status text;
begin
  if not public.is_lobby_member(p_lobby_id, p_user_id) then
    raise exception 'You are not in this lobby' using errcode = '42501';
  end if;

  select status into v_status from public.lobbies where id = p_lobby_id;
  if v_status = 'ARCHIVED' then
    raise exception 'This lobby is closed' using errcode = '22023';
  end if;

  if p_creator_side is null or p_creator_side not in ('YES', 'NO') then
    raise exception 'Pick a side — YES or NO' using errcode = '22023';
  end if;
  if coalesce(trim(p_proposition), '') = '' then
    raise exception 'Enter what the bet is about' using errcode = '22023';
  end if;
  if coalesce(trim(p_stake), '') = '' then
    raise exception 'Enter what is on the line' using errcode = '22023';
  end if;

  insert into public.bets (lobby_id, proposition, stake, creator_id, creator_side)
  values (p_lobby_id, left(trim(p_proposition), 280), left(trim(p_stake), 120),
          p_user_id, p_creator_side)
  returning * into v_bet;

  return v_bet;
end;
$$;

create or replace function public.accept_bet(p_user_id uuid, p_bet_id uuid)
returns public.bets language plpgsql as $$
declare
  v_current public.bets;
  v_bet public.bets;
begin
  select * into v_current from public.bets where id = p_bet_id;
  if not found then
    raise exception 'Bet not found' using errcode = 'P0002';
  end if;
  if not public.is_lobby_member(v_current.lobby_id, p_user_id) then
    raise exception 'You are not in this lobby' using errcode = '42501';
  end if;
  if v_current.creator_id = p_user_id then
    raise exception 'You cannot accept your own bet' using errcode = '22023';
  end if;

  -- The status guard inside UPDATE is what makes concurrent accepts safe:
  -- the row lock means exactly one caller sees status = 'OPEN'.
  update public.bets
     set status = 'ACCEPTED', acceptor_id = p_user_id, accepted_at = now()
   where id = p_bet_id and status = 'OPEN'
  returning * into v_bet;

  if not found then
    raise exception 'Someone already took this bet' using errcode = '22023';
  end if;
  return v_bet;
end;
$$;

create or replace function public.cancel_bet(p_user_id uuid, p_bet_id uuid)
returns public.bets language plpgsql as $$
declare
  v_bet public.bets;
begin
  update public.bets
     set status = 'CANCELLED'
   where id = p_bet_id and status = 'OPEN' and creator_id = p_user_id
  returning * into v_bet;

  if not found then
    raise exception 'Only the creator can cancel this bet, and only before it is accepted'
      using errcode = '22023';
  end if;
  return v_bet;
end;
$$;

create or replace function public.resolve_bet(p_user_id uuid, p_bet_id uuid, p_outcome text)
returns public.bets language plpgsql as $$
declare
  v_current public.bets;
  v_bet public.bets;
  v_winner uuid;
  v_loser uuid;
begin
  if p_outcome is null or p_outcome not in ('YES', 'NO') then
    raise exception 'Outcome must be YES or NO' using errcode = '22023';
  end if;

  select * into v_current from public.bets where id = p_bet_id;
  if not found then
    raise exception 'Bet not found' using errcode = 'P0002';
  end if;

  -- `is distinct from` is NULL-safe: an open bet has no acceptor, and a plain
  -- `not in` against a NULL would evaluate to NULL and skip the raise entirely.
  if p_user_id is null
     or (p_user_id is distinct from v_current.creator_id
         and p_user_id is distinct from v_current.acceptor_id) then
    raise exception 'Only the two people in this bet can resolve it' using errcode = '42501';
  end if;

  -- The creator wins when the outcome matches the side they took.
  if p_outcome = v_current.creator_side then
    v_winner := v_current.creator_id;
    v_loser  := v_current.acceptor_id;
  else
    v_winner := v_current.acceptor_id;
    v_loser  := v_current.creator_id;
  end if;

  update public.bets
     set status = 'RESOLVED', outcome = p_outcome,
         winner_id = v_winner, loser_id = v_loser, resolved_at = now()
   where id = p_bet_id and status = 'ACCEPTED'
  returning * into v_bet;

  if not found then
    raise exception 'Only accepted bets can be resolved' using errcode = '22023';
  end if;
  return v_bet;
end;
$$;

create or replace function public.complete_bet(p_user_id uuid, p_bet_id uuid)
returns public.bets language plpgsql as $$
declare
  v_current public.bets;
  v_bet public.bets;
begin
  select * into v_current from public.bets where id = p_bet_id;
  if not found then
    raise exception 'Bet not found' using errcode = 'P0002';
  end if;

  if p_user_id is null
     or (p_user_id is distinct from v_current.creator_id
         and p_user_id is distinct from v_current.acceptor_id) then
    raise exception 'Only the two people in this bet can settle it' using errcode = '42501';
  end if;

  update public.bets
     set status = 'COMPLETED', completed_at = now()
   where id = p_bet_id and status = 'RESOLVED'
  returning * into v_bet;

  if not found then
    raise exception 'Only resolved bets can be marked paid' using errcode = '22023';
  end if;
  return v_bet;
end;
$$;

-- --- host-only moderation -------------------------------------------------

create or replace function public.host_delete_bet(p_user_id uuid, p_bet_id uuid)
returns uuid language plpgsql as $$
declare
  v_lobby_id uuid;
begin
  select lobby_id into v_lobby_id from public.bets where id = p_bet_id;
  if not found then
    raise exception 'Bet not found' using errcode = 'P0002';
  end if;
  if not public.is_lobby_host(v_lobby_id, p_user_id) then
    raise exception 'Only the host can delete bets' using errcode = '42501';
  end if;

  delete from public.bets where id = p_bet_id;
  return p_bet_id;
end;
$$;

create or replace function public.host_undo_accept(p_user_id uuid, p_bet_id uuid)
returns public.bets language plpgsql as $$
declare
  v_lobby_id uuid;
  v_bet public.bets;
begin
  select lobby_id into v_lobby_id from public.bets where id = p_bet_id;
  if not found then
    raise exception 'Bet not found' using errcode = 'P0002';
  end if;
  if not public.is_lobby_host(v_lobby_id, p_user_id) then
    raise exception 'Only the host can undo an accept' using errcode = '42501';
  end if;

  update public.bets
     set status = 'OPEN', acceptor_id = null, accepted_at = null
   where id = p_bet_id and status = 'ACCEPTED'
  returning * into v_bet;

  if not found then
    raise exception 'Only accepted bets can be reopened' using errcode = '22023';
  end if;
  return v_bet;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------

-- "outstanding" is bets you lost but have not settled yet.
create or replace function public.lobby_leaderboard(p_lobby_id uuid)
returns table (
  user_id uuid, display_name text, avatar_url text,
  wins bigint, losses bigint, outstanding bigint, total_bets bigint
) language sql stable as $$
  select m.user_id,
         u.display_name,
         u.avatar_url,
         count(*) filter (where b.winner_id = m.user_id),
         count(*) filter (where b.loser_id  = m.user_id),
         count(*) filter (where b.loser_id  = m.user_id and b.status = 'RESOLVED'),
         count(*) filter (where b.status not in ('OPEN', 'CANCELLED'))
  from public.lobby_members m
  join public.users u on u.id = m.user_id
  left join public.bets b
    on b.lobby_id = m.lobby_id
   and (b.creator_id = m.user_id or b.acceptor_id = m.user_id)
  where m.lobby_id = p_lobby_id
  group by m.user_id, u.display_name, u.avatar_url
  order by 4 desc, 6 desc, 2 asc;
$$;

-- Everything one lobby screen needs, as a single document, or NULL when the
-- caller is not a member. One round trip beats four against a serverless
-- database, and it is the same document the page renders first and the poll
-- refreshes, so the two can never disagree about shape.
--
-- Bets carry the names of everyone they mention, not just ids: a player who
-- left the lobby is no longer in `members`, and their bets still need a name.
create or replace function public.lobby_snapshot(p_lobby_id uuid, p_user_id uuid)
returns jsonb language sql stable as $$
  select case when not public.is_lobby_member(p_lobby_id, p_user_id) then null else
    jsonb_build_object(
      'lobby', (select to_jsonb(l) from public.lobbies l where l.id = p_lobby_id),
      'members', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'user_id', m.user_id,
                 'role', m.role,
                 'joined_at', m.joined_at,
                 'display_name', u.display_name,
                 'avatar_url', u.avatar_url
               ) order by m.joined_at)
        from public.lobby_members m
        join public.users u on u.id = m.user_id
        where m.lobby_id = p_lobby_id
      ), '[]'::jsonb),
      'bets', coalesce((
        select jsonb_agg(to_jsonb(b) order by b.created_at desc)
        from public.bets b
        where b.lobby_id = p_lobby_id
      ), '[]'::jsonb),
      'names', coalesce((
        select jsonb_object_agg(u.id, u.display_name)
        from public.users u
        where u.id in (
          select unnest(array[b.creator_id, b.acceptor_id, b.winner_id, b.loser_id])
          from public.bets b where b.lobby_id = p_lobby_id
        )
      ), '{}'::jsonb),
      'leaderboard', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'user_id', r.user_id,
                 'display_name', r.display_name,
                 'avatar_url', r.avatar_url,
                 'wins', r.wins,
                 'losses', r.losses,
                 'outstanding', r.outstanding,
                 'total_bets', r.total_bets
               ) order by r.n)
        from public.lobby_leaderboard(p_lobby_id) with ordinality
          as r(user_id, display_name, avatar_url, wins, losses, outstanding, total_bets, n)
      ), '[]'::jsonb)
    )
  end;
$$;

create or replace function public.my_lobbies(p_user_id uuid)
returns table (
  id uuid, code text, name text, host_id uuid, status text,
  created_at timestamptz, member_count bigint
) language sql stable as $$
  select l.id, l.code, l.name, l.host_id, l.status, l.created_at,
         (select count(*) from public.lobby_members c where c.lobby_id = l.id)
  from public.lobbies l
  join public.lobby_members m on m.lobby_id = l.id and m.user_id = p_user_id
  order by l.created_at desc;
$$;
