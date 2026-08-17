-- Two fixes found by review.
--
-- 1. resolve_bet and complete_bet guarded participation with:
--
--        if auth.uid() not in (v_current.creator_id, v_current.acceptor_id)
--
--    When acceptor_id IS NULL and the caller is not the creator, that is
--    NOT (false OR NULL) = NULL, and PL/pgSQL treats a NULL IF as false — so
--    the authorisation raise was skipped entirely. The only thing still
--    stopping a stranger was the `status = 'ACCEPTED'` / `'RESOLVED'` predicate
--    on the UPDATE, which is a state check, not an authorisation check. It
--    happens to close the hole today (a bet with a NULL acceptor is never in
--    either state), but that is luck, not intent. `is distinct from` is
--    NULL-safe and restores the guard.
--
-- 2. public.profiles was never added to the supabase_realtime publication, so a
--    display-name change reached nobody until they reloaded. The client now
--    subscribes to profile updates; the table has to publish them.

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

  if auth.uid() is distinct from v_current.creator_id
     and auth.uid() is distinct from v_current.acceptor_id then
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

  if auth.uid() is distinct from v_current.creator_id
     and auth.uid() is distinct from v_current.acceptor_id then
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

-- CREATE OR REPLACE resets privileges to the default (EXECUTE to PUBLIC), so
-- re-apply the lockdown from 20260817000100 for the two functions above.
revoke execute on function public.resolve_bet(uuid, text) from public, anon;
revoke execute on function public.complete_bet(uuid) from public, anon;
grant execute on function
  public.resolve_bet(uuid, text),
  public.complete_bet(uuid)
  to authenticated;

alter table public.profiles replica identity full;
alter publication supabase_realtime add table public.profiles;
