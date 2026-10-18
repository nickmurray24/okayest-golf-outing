-- Phase 4 scoring fix: PostgreSQL operator precedence when validating hole JSON.
-- Safe to run against an existing Phase 4 database.
-- Replaces only public.okayest_match_save; does not modify golfers, PINs,
-- matches, existing scores, or organizer settings.
-- Do not rerun 01_phase4_supabase.sql for this issue.

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
       ((p_holes -> i) - 'black' - 'white')<>'{}'::jsonb or
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

-- Keep the RPC exposed to the same authorized API roles.
notify pgrst, 'reload schema';
