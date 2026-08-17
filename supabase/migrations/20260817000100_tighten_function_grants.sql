-- Close a hole left by the initial migration.
--
-- 20260817000000 ran:
--     revoke execute on all functions in schema public from anon, authenticated;
--
-- which looks like it locks the schema down but does nothing. Postgres grants
-- EXECUTE on every new function to PUBLIC by default, and both anon and
-- authenticated are members of PUBLIC. Revoking from those two roles by name
-- leaves the PUBLIC grant untouched, so `\dp` still showed `=X/postgres` — the
-- signed-out anon role could call every function in the schema.
--
-- No privilege escalation resulted (each mutation re-checks auth.uid() and
-- lobby membership internally), but internal helpers were reachable and the
-- migration did not mean what it said. Revoke from PUBLIC, then grant back
-- deliberately.

revoke execute on all functions in schema public from public, anon, authenticated;

-- The one thing a signed-out visitor may do: read an invite link.
grant execute on function public.lobby_preview(text) to anon, authenticated;

-- RLS policy expressions are evaluated as the querying role, so `authenticated`
-- needs EXECUTE on the predicates those policies call.
grant execute on function
  public.is_lobby_member(uuid),
  public.shares_lobby_with(uuid)
  to authenticated;

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
  public.lobby_leaderboard(uuid)
  to authenticated;

-- The trigger on auth.users fires as supabase_auth_admin. Now that PUBLIC no
-- longer confers EXECUTE, it needs an explicit grant — without this every
-- Google sign-in would succeed but silently fail to create a profile row.
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- generate_lobby_code and is_lobby_host are only called from inside other
-- SECURITY DEFINER functions, which run as the owner, so they stay ungranted.
