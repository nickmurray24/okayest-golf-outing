-- Okayest Golf Outing · shared four-digit golfer PIN migration.
-- Run ONCE in Supabase Dashboard > SQL Editor, as project owner.
-- Safe for existing roster, matchups, scores, and organizer PIN.
-- After running, Organizer > Golfers must SET the shared four-digit PIN.
-- Existing golfer sessions are signed out; the separate organizer PIN is unchanged.
-- IMPORTANT: Do not rerun database/01_phase4_supabase.sql after this upgrade,
-- since that earlier script restores the outdated player-login functions.

begin;

create table if not exists okayest_private.shared_golfer_access (
  id integer primary key default 1 check (id = 1),
  pin_hash text not null
);
revoke all on okayest_private.shared_golfer_access from public, anon, authenticated;

-- Sessions are now tied to current roster membership (not individual PIN records).
create or replace function okayest_private.session_role(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare session_row record;
begin
  if p_token is null or length(p_token) <> 64 or p_token !~ '^[a-f0-9]{64}$' then
    return null;
  end if;
  select player_id,is_organizer,expires_at into session_row
    from okayest_private.sessions
   where token_digest=encode(extensions.digest(decode(p_token,'hex'),'sha256'),'hex')
     and expires_at>now();
  if not found then return null; end if;
  if not session_row.is_organizer and not exists (
    select 1 from okayest_private.outing o,
      jsonb_array_elements(o.state->'players') p
    where o.id=1 and p->>'id'=session_row.player_id
  ) then return null; end if;
  return jsonb_build_object('role',case when session_row.is_organizer then 'organizer' else 'player' end,
    'player_id',session_row.player_id,'expires_at',session_row.expires_at);
end $fn$;

-- Keep rate limiting global to the common golfer PIN, rather than letting
-- someone bypass the attempt limit by trying many different roster names.
create or replace function public.okayest_player_login(p_player_id text,p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare digest_hash text; valid boolean := false; roster jsonb;
begin
  if p_player_id is null or length(p_player_id) > 150 or p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object('error','Select your name and enter the four-digit golfer PIN.');
  end if;
  if not okayest_private.attempt_allowed('golfer:shared') then
    return jsonb_build_object('error','Too many incorrect PIN attempts. Try again in about 20 minutes.');
  end if;
  select state->'players' into roster from okayest_private.outing where id=1;
  select pin_hash into digest_hash from okayest_private.shared_golfer_access where id=1;
  if digest_hash is not null
    and exists (select 1 from jsonb_array_elements(roster) p where p->>'id'=p_player_id) then
    valid := (extensions.crypt(p_pin,digest_hash)=digest_hash);
  end if;
  perform okayest_private.record_attempt('golfer:shared',valid);
  if not valid then
    return jsonb_build_object('error','Incorrect golfer PIN or shared golfer PIN not yet configured.');
  end if;
  return okayest_private.issue_session(p_player_id,false);
end $fn$;

create or replace function public.okayest_shared_pin_status(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
begin
  if coalesce(okayest_private.session_role(p_token)->>'role','') <> 'organizer' then
    raise exception 'Organizer sign-in required.' using errcode='42501';
  end if;
  return jsonb_build_object('configured',exists(select 1 from okayest_private.shared_golfer_access where id=1));
end $fn$;

create or replace function public.okayest_set_shared_pin(p_token text,p_pin text)
returns boolean language plpgsql security definer set search_path = '' as $fn$
begin
  if coalesce(okayest_private.session_role(p_token)->>'role','') <> 'organizer' then
    raise exception 'Organizer sign-in required.' using errcode='42501';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'Shared golfer PIN must contain exactly four digits.';
  end if;
  insert into okayest_private.shared_golfer_access(id,pin_hash)
    values (1,extensions.crypt(p_pin,extensions.gen_salt('bf',10)))
  on conflict(id) do update set pin_hash=excluded.pin_hash;
  -- Previously signed-in golfers must reauthenticate with the new shared PIN.
  delete from okayest_private.sessions where not is_organizer;
  -- Reset incorrect attempts when the organizer deliberately updates the PIN.
  delete from okayest_private.login_attempts where identity='golfer:shared';
  return true;
end $fn$;

-- Invalidate the old individual-PIN sessions during migration.
delete from okayest_private.sessions where not is_organizer;

-- Shut off the old per-golfer PIN management RPCs without dropping any records.
revoke execute on function public.okayest_pin_status(text) from public,anon,authenticated;
revoke execute on function public.okayest_set_pin(text,text,text) from public,anon,authenticated;
revoke execute on function public.okayest_shared_pin_status(text) from public,anon,authenticated;
revoke execute on function public.okayest_set_shared_pin(text,text) from public,anon,authenticated;
grant execute on function public.okayest_shared_pin_status(text) to anon,authenticated;
grant execute on function public.okayest_set_shared_pin(text,text) to anon,authenticated;

commit;
