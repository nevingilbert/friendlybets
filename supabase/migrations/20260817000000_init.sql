-- FriendlyBets — initial schema
--
-- Design notes:
--   * Every read goes through RLS on the tables directly (PostgREST select).
--   * Every write goes through a SECURITY DEFINER rpc. There are deliberately no
--     insert/update/delete policies, so the state machine below is the only way to
--     mutate data. This is what makes "accept" race-safe and keeps hosts honest.
--   * Helper predicates are SECURITY DEFINER to break RLS recursion: a policy on
--     lobby_members cannot itself query lobby_members under RLS.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create table public.lobbies (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  name       text not null check (char_length(name) between 1 and 60),
  host_id    uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'OPEN' check (status in ('OPEN', 'LOCKED', 'ARCHIVED')),
  created_at timestamptz not null default now()
);

create table public.lobby_members (
  lobby_id  uuid not null references public.lobbies (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      text not null default 'MEMBER' check (role in ('HOST', 'MEMBER')),
  joined_at timestamptz not null default now(),
  primary key (lobby_id, user_id)
);

create table public.bets (
  id           uuid primary key default gen_random_uuid(),
  lobby_id     uuid not null references public.lobbies (id) on delete cascade,
  proposition  text not null check (char_length(proposition) between 1 and 280),
  stake        text not null check (char_length(stake) between 1 and 120),
  creator_id   uuid not null references public.profiles (id) on delete cascade,
  creator_side text not null check (creator_side in ('YES', 'NO')),
  acceptor_id  uuid references public.profiles (id) on delete set null,
  status       text not null default 'OPEN'
                 check (status in ('OPEN', 'ACCEPTED', 'RESOLVED', 'COMPLETED', 'CANCELLED')),
  outcome      text check (outcome in ('YES', 'NO')),
  winner_id    uuid references public.profiles (id) on delete set null,
  loser_id     uuid references public.profiles (id) on delete set null,
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
-- Helper predicates (SECURITY DEFINER: they intentionally bypass RLS so that
-- policies which call them do not recurse into the table being protected)
-- ---------------------------------------------------------------------------

create or replace function public.is_lobby_member(p_lobby_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.lobby_members
    where lobby_id = p_lobby_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_lobby_host(p_lobby_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.lobbies
    where id = p_lobby_id and host_id = auth.uid()
  );
$$;

-- You can see someone's profile only if you currently share a lobby with them.
create or replace function public.shares_lobby_with(p_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.lobby_members me
    join public.lobby_members them on them.lobby_id = me.lobby_id
    where me.user_id = auth.uid() and them.user_id = p_user_id
  );
$$;

-- Ambiguous glyphs (0/O, 1/I) are excluded so codes survive being read aloud.
create or replace function public.generate_lobby_code()
returns text language plpgsql security definer set search_path = public as $$
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

-- ---------------------------------------------------------------------------
-- Profile provisioning: every auth.users row gets a profile automatically.
-- Google hands us full_name + avatar_url in raw_user_meta_data.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Guest'
    ), 40),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security — reads only. All writes go through the rpcs below.
-- ---------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.lobbies       enable row level security;
alter table public.lobby_members enable row level security;
alter table public.bets          enable row level security;

create policy "read own profile or co-members"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_lobby_with(id));

create policy "rename yourself"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "read lobbies you belong to"
  on public.lobbies for select to authenticated
  using (public.is_lobby_member(id));

create policy "read the roster of your lobbies"
  on public.lobby_members for select to authenticated
  using (public.is_lobby_member(lobby_id));

create policy "read bets in your lobbies"
  on public.bets for select to authenticated
  using (public.is_lobby_member(lobby_id));

-- ---------------------------------------------------------------------------
-- Lobby rpcs
-- ---------------------------------------------------------------------------

create or replace function public.create_lobby(p_name text)
returns public.lobbies language plpgsql security definer set search_path = public as $$
declare
  v_lobby public.lobbies;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Give your lobby a name';
  end if;

  insert into public.lobbies (code, name, host_id)
  values (public.generate_lobby_code(), left(trim(p_name), 60), auth.uid())
  returning * into v_lobby;

  insert into public.lobby_members (lobby_id, user_id, role)
  values (v_lobby.id, auth.uid(), 'HOST');

  return v_lobby;
end;
$$;

-- Readable by anon so an invite link can say "X invited you to Y" before sign-in.
create or replace function public.lobby_preview(p_code text)
returns table (id uuid, code text, name text, host_name text, member_count bigint, status text)
language sql security definer stable set search_path = public as $$
  select l.id,
         l.code,
         l.name,
         p.display_name,
         (select count(*) from public.lobby_members m where m.lobby_id = l.id),
         l.status
  from public.lobbies l
  join public.profiles p on p.id = l.host_id
  where l.code = upper(trim(p_code));
$$;

create or replace function public.join_lobby(p_code text)
returns public.lobbies language plpgsql security definer set search_path = public as $$
declare
  v_lobby public.lobbies;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;

  select * into v_lobby from public.lobbies where code = upper(trim(p_code));
  if not found then
    raise exception 'No lobby with that code' using errcode = 'P0002';
  end if;

  -- Already in? Joining again is a no-op so invite links stay idempotent.
  if exists (select 1 from public.lobby_members
             where lobby_id = v_lobby.id and user_id = auth.uid()) then
    return v_lobby;
  end if;

  if v_lobby.status <> 'OPEN' then
    raise exception 'This lobby is closed to new players';
  end if;

  insert into public.lobby_members (lobby_id, user_id, role)
  values (v_lobby.id, auth.uid(), 'MEMBER');

  return v_lobby;
end;
$$;

create or replace function public.leave_lobby(p_lobby_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.is_lobby_host(p_lobby_id) then
    raise exception 'The host cannot leave. Close the lobby instead.';
  end if;
  delete from public.lobby_members
  where lobby_id = p_lobby_id and user_id = auth.uid();
end;
$$;

create or replace function public.update_lobby(p_lobby_id uuid, p_name text default null, p_status text default null)
returns public.lobbies language plpgsql security definer set search_path = public as $$
declare
  v_lobby public.lobbies;
begin
  if not public.is_lobby_host(p_lobby_id) then
    raise exception 'Only the host can change this lobby' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('OPEN', 'LOCKED', 'ARCHIVED') then
    raise exception 'Unknown lobby status %', p_status;
  end if;

  update public.lobbies
     set name   = coalesce(nullif(left(trim(p_name), 60), ''), name),
         status = coalesce(p_status, status)
   where id = p_lobby_id
  returning * into v_lobby;

  return v_lobby;
end;
$$;

create or replace function public.remove_member(p_lobby_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_lobby_host(p_lobby_id) then
    raise exception 'Only the host can remove players' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'The host cannot remove themselves';
  end if;
  delete from public.lobby_members
  where lobby_id = p_lobby_id and user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bet rpcs — the lifecycle is OPEN -> ACCEPTED -> RESOLVED -> COMPLETED,
-- with CANCELLED reachable from OPEN only.
-- ---------------------------------------------------------------------------

create or replace function public.create_bet(
  p_lobby_id uuid, p_proposition text, p_stake text, p_creator_side text
) returns public.bets language plpgsql security definer set search_path = public as $$
declare
  v_bet public.bets;
  v_status text;
begin
  if not public.is_lobby_member(p_lobby_id) then
    raise exception 'You are not in this lobby' using errcode = '42501';
  end if;

  select status into v_status from public.lobbies where id = p_lobby_id;
  if v_status = 'ARCHIVED' then
    raise exception 'This lobby is closed';
  end if;

  if p_creator_side not in ('YES', 'NO') then
    raise exception 'Pick a side — YES or NO';
  end if;
  if coalesce(trim(p_proposition), '') = '' then
    raise exception 'Enter what the bet is about';
  end if;
  if coalesce(trim(p_stake), '') = '' then
    raise exception 'Enter what is on the line';
  end if;

  insert into public.bets (lobby_id, proposition, stake, creator_id, creator_side)
  values (p_lobby_id, left(trim(p_proposition), 280), left(trim(p_stake), 120),
          auth.uid(), p_creator_side)
  returning * into v_bet;

  return v_bet;
end;
$$;

create or replace function public.accept_bet(p_bet_id uuid)
returns public.bets language plpgsql security definer set search_path = public as $$
declare
  v_current public.bets;
  v_bet public.bets;
begin
  select * into v_current from public.bets where id = p_bet_id;
  if not found then
    raise exception 'Bet not found' using errcode = 'P0002';
  end if;
  if not public.is_lobby_member(v_current.lobby_id) then
    raise exception 'You are not in this lobby' using errcode = '42501';
  end if;
  if v_current.creator_id = auth.uid() then
    raise exception 'You cannot accept your own bet';
  end if;

  -- The status guard inside UPDATE is what makes concurrent accepts safe:
  -- the row lock means exactly one caller sees status = 'OPEN'.
  update public.bets
     set status = 'ACCEPTED', acceptor_id = auth.uid(), accepted_at = now()
   where id = p_bet_id and status = 'OPEN'
  returning * into v_bet;

  if not found then
    raise exception 'Someone already took this bet';
  end if;
  return v_bet;
end;
$$;

create or replace function public.cancel_bet(p_bet_id uuid)
returns public.bets language plpgsql security definer set search_path = public as $$
declare
  v_bet public.bets;
begin
  update public.bets
     set status = 'CANCELLED'
   where id = p_bet_id and status = 'OPEN' and creator_id = auth.uid()
  returning * into v_bet;

  if not found then
    raise exception 'Only the creator can cancel this bet, and only before it is accepted';
  end if;
  return v_bet;
end;
$$;

create or replace function public.resolve_bet(p_bet_id uuid, p_outcome text)
returns public.bets language plpgsql security definer set search_path = public as $$
declare
  v_current public.bets;
  v_bet public.bets;
  v_winner uuid;
  v_loser uuid;
begin
  if p_outcome not in ('YES', 'NO') then
    raise exception 'Outcome must be YES or NO';
  end if;

  select * into v_current from public.bets where id = p_bet_id;
  if not found then
    raise exception 'Bet not found' using errcode = 'P0002';
  end if;
  if auth.uid() not in (v_current.creator_id, v_current.acceptor_id) then
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
    raise exception 'Only accepted bets can be resolved';
  end if;
  return v_bet;
end;
$$;

create or replace function public.complete_bet(p_bet_id uuid)
returns public.bets language plpgsql security definer set search_path = public as $$
declare
  v_current public.bets;
  v_bet public.bets;
begin
  select * into v_current from public.bets where id = p_bet_id;
  if not found then
    raise exception 'Bet not found' using errcode = 'P0002';
  end if;
  if auth.uid() not in (v_current.creator_id, v_current.acceptor_id) then
    raise exception 'Only the two people in this bet can settle it' using errcode = '42501';
  end if;

  update public.bets
     set status = 'COMPLETED', completed_at = now()
   where id = p_bet_id and status = 'RESOLVED'
  returning * into v_bet;

  if not found then
    raise exception 'Only resolved bets can be marked paid';
  end if;
  return v_bet;
end;
$$;

-- --- host-only moderation -------------------------------------------------

create or replace function public.host_delete_bet(p_bet_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_lobby_id uuid;
begin
  select lobby_id into v_lobby_id from public.bets where id = p_bet_id;
  if not found then
    raise exception 'Bet not found' using errcode = 'P0002';
  end if;
  if not public.is_lobby_host(v_lobby_id) then
    raise exception 'Only the host can delete bets' using errcode = '42501';
  end if;

  delete from public.bets where id = p_bet_id;
  return p_bet_id;
end;
$$;

create or replace function public.host_undo_accept(p_bet_id uuid)
returns public.bets language plpgsql security definer set search_path = public as $$
declare
  v_lobby_id uuid;
  v_bet public.bets;
begin
  select lobby_id into v_lobby_id from public.bets where id = p_bet_id;
  if not found then
    raise exception 'Bet not found' using errcode = 'P0002';
  end if;
  if not public.is_lobby_host(v_lobby_id) then
    raise exception 'Only the host can undo an accept' using errcode = '42501';
  end if;

  update public.bets
     set status = 'OPEN', acceptor_id = null, accepted_at = null
   where id = p_bet_id and status = 'ACCEPTED'
  returning * into v_bet;

  if not found then
    raise exception 'Only accepted bets can be reopened';
  end if;
  return v_bet;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard — "outstanding" is bets you lost but have not settled yet.
-- ---------------------------------------------------------------------------

create or replace function public.lobby_leaderboard(p_lobby_id uuid)
returns table (
  user_id uuid, display_name text, avatar_url text,
  wins bigint, losses bigint, outstanding bigint, total_bets bigint
) language sql security definer stable set search_path = public as $$
  select m.user_id,
         p.display_name,
         p.avatar_url,
         count(*) filter (where b.winner_id = m.user_id),
         count(*) filter (where b.loser_id  = m.user_id),
         count(*) filter (where b.loser_id  = m.user_id and b.status = 'RESOLVED'),
         count(*) filter (where b.status not in ('OPEN', 'CANCELLED'))
  from public.lobby_members m
  join public.profiles p on p.id = m.user_id
  left join public.bets b
    on b.lobby_id = m.lobby_id
   and (b.creator_id = m.user_id or b.acceptor_id = m.user_id)
  where m.lobby_id = p_lobby_id
    and public.is_lobby_member(p_lobby_id)
  group by m.user_id, p.display_name, p.avatar_url
  order by 4 desc, 6 desc, 2 asc;
$$;

-- ---------------------------------------------------------------------------
-- Grants — anon may only preview an invite link; everything else needs a session.
-- NOTE: this revoke is incomplete; 20260817000100 tightens it. See that file.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from anon, authenticated;

grant execute on function public.lobby_preview(text) to anon, authenticated;

grant execute on function
  public.create_lobby(text),
  public.join_lobby(text),
  public.leave_lobby(uuid),
  public.update_lobby(uuid, text, text),
  public.remove_member(uuid, uuid),
  public.create_bet(uuid, text, text, text),
  public.accept_bet(uuid),
  public.cancel_bet(uuid),
  public.resolve_bet(uuid, text),
  public.complete_bet(uuid),
  public.host_delete_bet(uuid),
  public.host_undo_accept(uuid),
  public.lobby_leaderboard(uuid),
  public.is_lobby_member(uuid),
  public.is_lobby_host(uuid),
  public.shares_lobby_with(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime. REPLICA IDENTITY FULL is required so DELETE events still carry
-- lobby_id — without it the payload is the primary key only and clients
-- subscribed with a lobby_id filter would never see the delete.
-- ---------------------------------------------------------------------------

alter table public.bets          replica identity full;
alter table public.lobby_members replica identity full;
alter table public.lobbies       replica identity full;

alter publication supabase_realtime add table public.bets;
alter publication supabase_realtime add table public.lobby_members;
alter publication supabase_realtime add table public.lobbies;
