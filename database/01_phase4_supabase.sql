-- The Okayest Golf Outing Ever · Phase 4 Supabase schema
-- IMPORTANT: Edit the organizer PIN placeholder before running this script.
-- Run in Supabase > SQL Editor as database owner. No service-role key is used in React.
-- Re-running is safe for existing outing data and PINs; it will NOT reset them.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists okayest_private;
revoke all on schema okayest_private from public, anon, authenticated;

create table if not exists okayest_private.outing (
  id integer primary key default 1 check (id = 1),
  state jsonb not null,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists okayest_private.player_access (
  player_id text primary key,
  pin_hash text not null
);
create table if not exists okayest_private.organizer_access (
  id integer primary key default 1 check (id = 1),
  pin_hash text not null
);
create table if not exists okayest_private.login_attempts (
  identity text primary key,
  attempts integer not null default 0,
  window_started timestamptz not null default now(),
  locked_until timestamptz
);
create table if not exists okayest_private.sessions (
  token_digest text primary key,
  player_id text,
  is_organizer boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check ((player_id is null) = is_organizer)
);
create index if not exists okayest_sessions_expire_idx on okayest_private.sessions(expires_at);

-- Anonymous subscribers see only a revision counter, NOT private scores or PINs.
create table if not exists public.okayest_updates (
  id integer primary key default 1 check (id = 1),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.okayest_updates (id,revision) values (1,0) on conflict (id) do nothing;
alter table public.okayest_updates enable row level security;
revoke all on public.okayest_updates from public, anon, authenticated;
grant select on public.okayest_updates to anon,authenticated;
drop policy if exists okayest_updates_read on public.okayest_updates;
create policy okayest_updates_read on public.okayest_updates for select to anon,authenticated using (true);

-- Both old and new Supabase projects: enable Postgres Changes publication.
do $do$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') and
     not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='okayest_updates') then
    alter publication supabase_realtime add table public.okayest_updates;
  end if;
end $do$;

insert into okayest_private.outing (id,state) values (1,
$outing${"version":3,"config":{"name":"The Okayest Golf Outing Ever","estimatedGolfers":17,"teams":[{"id":"black","name":"Team Black"},{"id":"white","name":"Team White"}],"rounds":[{"id":"singles","number":1,"name":"Singles","shortName":"Singles","format":"1 vs 1 \u00b7 Match Play","matchCount":8,"pointsPerMatch":1,"holeStart":1,"holeEnd":9,"summary":"Every golfer plays their own ball. The lowest score takes the hole."},{"id":"alternate-shot","number":2,"name":"Alternate Shot","shortName":"Alt. Shot","format":"2 vs 2 \u00b7 Match Play","matchCount":4,"pointsPerMatch":1,"holeStart":10,"holeEnd":18,"summary":"Partners alternate tee shots by odd/even holes, then alternate strokes."},{"id":"scramble","number":3,"name":"2 vs 2 Scramble","shortName":"Scramble","format":"2 vs 2 \u00b7 Match Play","matchCount":4,"pointsPerMatch":1,"holeStart":1,"holeEnd":9,"summary":"Both partners hit; the team chooses which ball to play next."}]},"players":[],"matches":[{"id":"singles-1","roundId":"singles","number":1,"black":[""],"white":[""],"holes":[{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null}],"finalized":false,"revision":0},{"id":"singles-2","roundId":"singles","number":2,"black":[""],"white":[""],"holes":[{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null}],"finalized":false,"revision":0},{"id":"singles-3","roundId":"singles","number":3,"black":[""],"white":[""],"holes":[{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null}],"finalized":false,"revision":0},{"id":"singles-4","roundId":"singles","number":4,"black":[""],"white":[""],"holes":[{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null}],"finalized":false,"revision":0},{"id":"singles-5","roundId":"singles","number":5,"black":[""],"white":[""],"holes":[{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null}],"finalized":false,"revision":0},{"id":"singles-6","roundId":"singles","number":6,"black":[""],"white":[""],"holes":[{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null}],"finalized":false,"revision":0},{"id":"singles-7","roundId":"singles","number":7,"black":[""],"white":[""],"holes":[{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null}],"finalized":false,"revision":0},{"id":"singles-8","roundId":"singles","number":8,"black":[""],"white":[""],"holes":[{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null}],"finalized":false,"revision":0},{"id":"alternate-shot-1","roundId":"alternate-shot","number":1,"black":["",""],"white":["",""],"holes":[{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null}],"finalized":false,"revision":0},{"id":"alternate-shot-2","roundId":"alternate-shot","number":2,"black":["",""],"white":["",""],"holes":[{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null}],"finalized":false,"revision":0},{"id":"alternate-shot-3","roundId":"alternate-shot","number":3,"black":["",""],"white":["",""],"holes":[{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null}],"finalized":false,"revision":0},{"id":"alternate-shot-4","roundId":"alternate-shot","number":4,"black":["",""],"white":["",""],"holes":[{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null}],"finalized":false,"revision":0},{"id":"scramble-1","roundId":"scramble","number":1,"black":["",""],"white":["",""],"holes":[{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null}],"finalized":false,"revision":0},{"id":"scramble-2","roundId":"scramble","number":2,"black":["",""],"white":["",""],"holes":[{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null}],"finalized":false,"revision":0},{"id":"scramble-3","roundId":"scramble","number":3,"black":["",""],"white":["",""],"holes":[{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null}],"finalized":false,"revision":0},{"id":"scramble-4","roundId":"scramble","number":4,"black":["",""],"white":["",""],"holes":[{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null},{"black":null,"white":null}],"finalized":false,"revision":0}]}$outing$::jsonb
) on conflict (id) do nothing;

-- Replace this placeholder before you run the SQL. The script refuses to create
-- the organizer login until you do. 12+ characters is recommended.
do $setup$
declare pin text := 'YOUR_NEW_PRIVATE_PIN';
begin
  if pin = 'CHANGE_THIS_TO_YOUR_PRIVATE_ORGANIZER_PIN' and
     not exists (
       select 1
       from okayest_private.organizer_access
       where id = 1
     ) then
    raise exception 'Choose an organizer PIN by changing the placeholder in the SQL script.';
  end if;

  if pin <> 'CHANGE_THIS_TO_YOUR_PRIVATE_ORGANIZER_PIN' then
    if length(pin) < 8 or length(pin) > 80 then
      raise exception 'Organizer PIN must be 8 to 80 characters.';
    end if;

    insert into okayest_private.organizer_access (id, pin_hash)
    values (1, extensions.crypt(pin, extensions.gen_salt('bf', 10)))
    on conflict (id) do nothing;
  end if;
end $setup$;

-- Internal functions are NOT exposed through the Supabase Data API.
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
  -- Removed golfers and reset PINs must no longer have valid sessions.
  if not session_row.is_organizer and not exists (
    select 1 from okayest_private.player_access where player_id=session_row.player_id
  ) then return null; end if;
  return jsonb_build_object('role',case when session_row.is_organizer then 'organizer' else 'player' end,
    'player_id', session_row.player_id, 'expires_at',session_row.expires_at);
end $fn$;

create or replace function okayest_private.attempt_allowed(p_identity text)
returns boolean language plpgsql security definer set search_path = '' as $fn$
declare row_attempt record;
begin
  select * into row_attempt from okayest_private.login_attempts where identity=p_identity for update;
  if not found then return true; end if;
  if row_attempt.locked_until is not null and row_attempt.locked_until > now() then return false; end if;
  if row_attempt.window_started < now()-interval '15 minutes' then
    delete from okayest_private.login_attempts where identity=p_identity;
  end if;
  return true;
end $fn$;

create or replace function okayest_private.record_attempt(p_identity text,p_valid boolean)
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  if p_valid then
    delete from okayest_private.login_attempts where identity=p_identity;
  else
    insert into okayest_private.login_attempts(identity,attempts,window_started,locked_until)
    values (p_identity,1,now(),null)
    on conflict (identity) do update set
      attempts = case when okayest_private.login_attempts.window_started < now()-interval '15 minutes' then 1
                  else okayest_private.login_attempts.attempts+1 end,
      window_started = case when okayest_private.login_attempts.window_started < now()-interval '15 minutes' then now()
                            else okayest_private.login_attempts.window_started end,
      locked_until = case when okayest_private.login_attempts.attempts >= 4
                              and okayest_private.login_attempts.window_started >= now()-interval '15 minutes'
                          then now()+interval '20 minutes' else null end;
  end if;
end $fn$;

create or replace function okayest_private.issue_session(p_player_id text,p_admin boolean)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare token text; expiration timestamptz := now()+interval '7 days';
begin
  token := encode(extensions.gen_random_bytes(32),'hex');
  delete from okayest_private.sessions where expires_at < now();
  insert into okayest_private.sessions(token_digest,player_id,is_organizer,expires_at)
  values (encode(extensions.digest(decode(token,'hex'),'sha256'),'hex'),p_player_id,p_admin,expiration);
  return jsonb_build_object('token',token,'role',case when p_admin then 'organizer' else 'player' end,
                            'player_id',p_player_id,'expires_at',expiration);
end $fn$;

create or replace function public.okayest_read()
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select jsonb_build_object('state',state,'revision',revision) from okayest_private.outing where id=1;
$fn$;

create or replace function public.okayest_player_login(p_player_id text,p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare digest_hash text; identity_key text; valid boolean := false; roster jsonb;
begin
  if p_player_id is null or length(p_player_id) > 150 or p_pin is null or length(p_pin)>80 then
    return jsonb_build_object('error','Invalid name or PIN.');
  end if;
  identity_key := 'golfer:'||p_player_id;
  if not okayest_private.attempt_allowed(identity_key) then
    return jsonb_build_object('error','Too many attempts. Try again in about 20 minutes.');
  end if;
  select state->'players' into roster from okayest_private.outing where id=1;
  select pin_hash into digest_hash from okayest_private.player_access where player_id=p_player_id;
  if digest_hash is not null and p_pin ~ '^[0-9]{6,12}$'
     and exists(select 1 from jsonb_array_elements(roster) entry where entry->>'id'=p_player_id) then
    valid := extensions.crypt(p_pin,digest_hash)=digest_hash;
  end if;
  perform okayest_private.record_attempt(identity_key,valid);
  if not valid then return jsonb_build_object('error','Invalid name or PIN, or no PIN has been assigned.'); end if;
  return okayest_private.issue_session(p_player_id,false);
end $fn$;

create or replace function public.okayest_organizer_login(p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare digest_hash text; valid boolean := false;
begin
  if not okayest_private.attempt_allowed('organizer') then
    return jsonb_build_object('error','Too many attempts. Try again in about 20 minutes.');
  end if;
  select pin_hash into digest_hash from okayest_private.organizer_access where id=1;
  if digest_hash is not null and p_pin is not null and length(p_pin) between 8 and 80 then
    valid := extensions.crypt(p_pin,digest_hash)=digest_hash;
  end if;
  perform okayest_private.record_attempt('organizer',valid);
  if not valid then return jsonb_build_object('error','Incorrect organizer PIN.'); end if;
  return okayest_private.issue_session(null,true);
end $fn$;

create or replace function public.okayest_session_info(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare auth jsonb;
begin
  auth := okayest_private.session_role(p_token);
  if auth is null then return jsonb_build_object('error','Session expired. Please sign in again.'); end if;
  return auth;
end $fn$;

create or replace function public.okayest_logout(p_token text)
returns boolean language plpgsql security definer set search_path = '' as $fn$
begin
  if okayest_private.session_role(p_token) is null then return false; end if;
  delete from okayest_private.sessions where token_digest=encode(extensions.digest(decode(p_token,'hex'),'sha256'),'hex');
  return true;
end $fn$;

create or replace function public.okayest_pin_status(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
begin
  if coalesce(okayest_private.session_role(p_token)->>'role','') <> 'organizer' then
    raise exception 'Organizer sign-in required.' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(player_id) from okayest_private.player_access), '[]'::jsonb);
end $fn$;

create or replace function public.okayest_set_pin(p_token text,p_player_id text,p_pin text)
returns boolean language plpgsql security definer set search_path = '' as $fn$
begin
  if coalesce(okayest_private.session_role(p_token)->>'role','') <> 'organizer' then
    raise exception 'Organizer sign-in required.' using errcode='42501';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{6,12}$' then
    raise exception 'Golfer PIN must contain 6 to 12 digits.';
  end if;
  if not exists (select 1 from okayest_private.outing o, jsonb_array_elements(o.state->'players') p
                   where o.id=1 and p->>'id'=p_player_id) then
    raise exception 'Golfer not found.';
  end if;
  insert into okayest_private.player_access(player_id,pin_hash)
  values(p_player_id,extensions.crypt(p_pin,extensions.gen_salt('bf',10)))
  on conflict(player_id) do update set pin_hash=excluded.pin_hash;
  -- Any previous login with the old PIN is invalidated immediately.
  delete from okayest_private.sessions where player_id=p_player_id;
  return true;
end $fn$;

-- Only organizer can replace outing setup; reject stale snapshots instead of
-- silently overwriting a score entered by another phone in the meantime.
create or replace function public.okayest_organizer_save(p_token text,p_expected_revision bigint,p_state jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare old_revision bigint; new_revision bigint; clean_players jsonb; entry jsonb; clean_matches jsonb;
        round_item jsonb; current_match jsonb; seen text[] := array[]::text[];
begin
  if coalesce(okayest_private.session_role(p_token)->>'role','') <> 'organizer' then
    raise exception 'Organizer sign-in required.' using errcode='42501';
  end if;
  if p_state is null or length(p_state::text)>2000000 or p_state->>'version' <> '3'
     or jsonb_typeof(p_state->'players') <> 'array'
     or jsonb_typeof(p_state->'matches') <> 'array'
     or jsonb_typeof(p_state->'config'->'rounds') <> 'array'
     or jsonb_array_length(p_state->'players')>1000
     or jsonb_array_length(p_state->'matches')>600
     or jsonb_array_length(p_state->'config'->'rounds')<>3 then
    raise exception 'Invalid outing setup payload.';
  end if;
  -- Never persist private-looking properties from uploaded organizer backups.
  clean_players := '[]'::jsonb;
  for entry in select value from jsonb_array_elements(p_state->'players') loop
    if entry->>'id' is null or length(entry->>'id')>150 or
       length(btrim(coalesce(entry->>'name',''))) not between 1 and 70 or
       coalesce(entry->>'teamId','') not in ('black','white','') or
       (entry->>'id')=any(seen) then
      raise exception 'Invalid or duplicated golfer.';
    end if;
    seen := array_append(seen,entry->>'id');
    clean_players := clean_players || jsonb_build_array(jsonb_build_object(
       'id',entry->>'id','name',btrim(entry->>'name'),'teamId',coalesce(entry->>'teamId','')));
  end loop;
  if (select count(*) from jsonb_array_elements(p_state->'config'->'rounds'))<>3 or
     exists(select 1 from jsonb_array_elements(p_state->'config'->'rounds') r
            where r->>'id' not in ('singles','alternate-shot','scramble') or
               (r->>'matchCount')::numeric not between 1 and 200 or
               (r->>'pointsPerMatch')::numeric not between 0.5 and 10 or
               ((r->>'pointsPerMatch')::numeric * 2) <> trunc((r->>'pointsPerMatch')::numeric * 2)) then
    raise exception 'Invalid round configuration.';
  end if;
  clean_matches := '[]'::jsonb;
  seen := array[]::text[];
  for current_match in select value from jsonb_array_elements(p_state->'matches') loop
    if current_match->>'id' is null or (current_match->>'id')=any(seen) or
       current_match->>'roundId' not in ('singles','alternate-shot','scramble') or
       jsonb_typeof(current_match->'black') <> 'array' or
       jsonb_typeof(current_match->'white') <> 'array' or
       jsonb_typeof(current_match->'holes') <> 'array' or
       jsonb_array_length(current_match->'holes')<>9 or
       jsonb_array_length(current_match->'black')<>(case when current_match->>'roundId'='singles' then 1 else 2 end) or
       jsonb_array_length(current_match->'white')<>(case when current_match->>'roundId'='singles' then 1 else 2 end) then
      raise exception 'Invalid match configuration.';
    end if;
    seen := array_append(seen,current_match->>'id');
    -- Organizer may deliberately restore a backup, including scores. Match
    -- validation is strict for golfers; the organizer is the trusted authority.
    clean_matches := clean_matches || jsonb_build_array(jsonb_build_object(
      'id',current_match->>'id','roundId',current_match->>'roundId',
      'number',(current_match->>'number')::integer,
      'black',current_match->'black','white',current_match->'white',
      'holes',current_match->'holes','finalized',coalesce((current_match->>'finalized')::boolean,false),
      'revision',coalesce((current_match->>'revision')::integer,0)));
  end loop;
  select revision into old_revision from okayest_private.outing where id=1 for update;
  if old_revision <> p_expected_revision then
    raise exception 'The outing changed on another phone. Reload and try again.' using errcode='40001';
  end if;
  -- Preserve current version numbers for existing matches, so players editing
  -- any scorecards do not bypass match-level optimistic concurrency checks.
  clean_matches := coalesce((select jsonb_agg(
      m.value || jsonb_build_object('revision',coalesce((
        select (prior.value->>'revision')::integer
        from jsonb_array_elements((select state->'matches' from okayest_private.outing where id=1)) prior
        where prior.value->>'id'=m.value->>'id' limit 1),0) +
        case when exists(select 1 from jsonb_array_elements((select state->'matches' from okayest_private.outing where id=1)) before_m
                    where before_m.value->>'id'=m.value->>'id'
                      and (before_m.value-'revision')<>(m.value-'revision')) then 1 else 0 end)
     ) from jsonb_array_elements(clean_matches) m), '[]'::jsonb);
  update okayest_private.outing
     set state=jsonb_build_object('version',3,
       'config',p_state->'config','players',clean_players,'matches',clean_matches),
       revision=revision+1,updated_at=now()
   where id=1 returning revision into new_revision;
  -- Removed players lose their old PIN and old sessions.
  delete from okayest_private.player_access a
   where not exists (select 1 from jsonb_array_elements(clean_players) p where p->>'id'=a.player_id);
  delete from okayest_private.sessions s where not s.is_organizer
    and not exists(select 1 from jsonb_array_elements(clean_players) p where p->>'id'=s.player_id);
  update public.okayest_updates set revision=new_revision,updated_at=now() where id=1;
  return jsonb_build_object('revision',new_revision,'state',(select state from okayest_private.outing where id=1));
end $fn$;

-- Signed-in golfers may change only their assigned match's strokes and final
-- state. The server independently verifies the hole data and match outcome.
create or replace function public.okayest_match_save(
  p_token text,p_match_id text,p_expected_match_revision integer,
  p_holes jsonb,p_finalized boolean
)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare auth jsonb; old_state jsonb; old_match jsonb; new_match jsonb;
  match_number integer; player_id text; is_admin boolean;
  i integer; black_score integer; white_score integer;
  black_wins integer := 0; white_wins integer := 0; through_holes integer := 0;
  finished boolean := false; finished_index integer := 0;
  new_revision bigint;
begin
  auth := okayest_private.session_role(p_token);
  if auth is null then raise exception 'Session expired. Sign in again.' using errcode='42501'; end if;
  is_admin := auth->>'role'='organizer';
  player_id := auth->>'player_id';
  if p_match_id is null or length(p_match_id)>150 or
     jsonb_typeof(p_holes)<>'array' or jsonb_array_length(p_holes)<>9 then
    raise exception 'Invalid scorecard.';
  end if;
  select state into old_state from okayest_private.outing where id=1 for update;
  select value into old_match from jsonb_array_elements(old_state->'matches')
    where value->>'id'=p_match_id limit 1;
  if old_match is null then raise exception 'Match not found.'; end if;
  if not is_admin and not (
    old_match->'black' ? player_id or old_match->'white' ? player_id
  ) then raise exception 'You can edit only your own matches.' using errcode='42501'; end if;
  if (old_match->>'revision')::integer <> p_expected_match_revision then
    raise exception 'Another golfer updated this scorecard. Refresh and try again.' using errcode='40001';
  end if;
  if exists (select 1 from jsonb_array_elements(old_match->'black') x where x.value='""'::jsonb)
     or exists (select 1 from jsonb_array_elements(old_match->'white') x where x.value='""'::jsonb) then
    raise exception 'A complete lineup is required before scoring.';
  end if;
  for i in 0..8 loop
    if jsonb_typeof(p_holes->i)<>'object' or
       (p_holes->i-'black'-'white')<>'{}'::jsonb or
       (p_holes->i->'black') is null or (p_holes->i->'white') is null then
      raise exception 'Each hole must have two stroke entries (or null).';
    end if;
    if jsonb_typeof(p_holes->i->'black') not in ('number','null') or
       jsonb_typeof(p_holes->i->'white') not in ('number','null') then
      raise exception 'Strokes must be numbers or blank.';
    end if;
    black_score := null; white_score := null;
    if jsonb_typeof(p_holes->i->'black')='number' then
      black_score := (p_holes->i->>'black')::numeric;
      if black_score::numeric <> (p_holes->i->>'black')::numeric or black_score not between 1 and 20 then
        raise exception 'Each stroke count must be between 1 and 20.';
      end if;
    end if;
    if jsonb_typeof(p_holes->i->'white')='number' then
      white_score := (p_holes->i->>'white')::numeric;
      if white_score::numeric <> (p_holes->i->>'white')::numeric or white_score not between 1 and 20 then
        raise exception 'Each stroke count must be between 1 and 20.';
      end if;
    end if;
    if finished and (black_score is not null or white_score is not null) then
      raise exception 'Do not score holes after the match has already finished.';
    end if;
    if black_score is null or white_score is null then
      -- Incomplete future entries may exist while golfers are still entering.
      continue;
    end if;
    if i <> through_holes then continue; end if;
    through_holes := through_holes+1;
    if black_score<white_score then black_wins:=black_wins+1; end if;
    if white_score<black_score then white_wins:=white_wins+1; end if;
    if abs(black_wins-white_wins)>9-through_holes or through_holes=9 then
      finished:=true;
      finished_index:=through_holes;
    end if;
  end loop;
  if p_finalized and not finished then
    raise exception 'The match cannot be finalized until its result is decided.';
  end if;
  new_match := jsonb_build_object('id',old_match->>'id','roundId',old_match->>'roundId',
    'number',old_match->'number','black',old_match->'black','white',old_match->'white',
    'holes',p_holes,'finalized',p_finalized,'revision',p_expected_match_revision+1);
  update okayest_private.outing set state=jsonb_set(state,'{matches}',(
      select jsonb_agg(case when value->>'id'=p_match_id then new_match else value end order by ord)
      from jsonb_array_elements(state->'matches') with ordinality as m(value,ord)
    )),revision=revision+1,updated_at=now()
    where id=1 returning revision into new_revision;
  update public.okayest_updates set revision=new_revision,updated_at=now() where id=1;
  return jsonb_build_object('revision',new_revision,'match_revision',p_expected_match_revision+1);
end $fn$;

-- Strict function grants: anon API key has no table writes and can execute
-- ONLY this small set of explicitly authorized RPC functions.
revoke all on all tables in schema okayest_private from public,anon,authenticated;
revoke all on all functions in schema okayest_private from public,anon,authenticated;
revoke execute on function public.okayest_read() from public,anon,authenticated;
revoke execute on function public.okayest_player_login(text,text) from public,anon,authenticated;
revoke execute on function public.okayest_organizer_login(text) from public,anon,authenticated;
revoke execute on function public.okayest_session_info(text) from public,anon,authenticated;
revoke execute on function public.okayest_logout(text) from public,anon,authenticated;
revoke execute on function public.okayest_pin_status(text) from public,anon,authenticated;
revoke execute on function public.okayest_set_pin(text,text,text) from public,anon,authenticated;
revoke execute on function public.okayest_organizer_save(text,bigint,jsonb) from public,anon,authenticated;
revoke execute on function public.okayest_match_save(text,text,integer,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.okayest_read() to anon,authenticated;
grant execute on function public.okayest_player_login(text,text) to anon,authenticated;
grant execute on function public.okayest_organizer_login(text) to anon,authenticated;
grant execute on function public.okayest_session_info(text) to anon,authenticated;
grant execute on function public.okayest_logout(text) to anon,authenticated;
grant execute on function public.okayest_pin_status(text) to anon,authenticated;
grant execute on function public.okayest_set_pin(text,text,text) to anon,authenticated;
grant execute on function public.okayest_organizer_save(text,bigint,jsonb) to anon,authenticated;
grant execute on function public.okayest_match_save(text,text,integer,jsonb,boolean) to anon,authenticated;
notify pgrst, 'reload schema';
