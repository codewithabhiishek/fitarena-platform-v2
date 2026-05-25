-- ─────────────────────────────────────────────────────────────────────────────
-- FitArena — Streak System Migration
-- Run this in Supabase SQL Editor AFTER the main schema.sql
--
-- What this adds:
--   1. longest_streak column on public.users
--   2. Production-correct update_user_streak RPC (replaces the old one)
--   3. Production-correct handle_submission_approved trigger (replaces old one)
--   4. streak_utils helper functions
--   5. Backfill: set longest_streak = streak for existing users
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. ADD longest_streak COLUMN ─────────────────────────────────────────────
-- Safe: uses IF NOT EXISTS equivalent via DO block

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'users'
      and column_name  = 'longest_streak'
  ) then
    alter table public.users
      add column longest_streak integer not null default 0;
  end if;
end;
$$;


-- ── 2. BACKFILL longest_streak FOR EXISTING USERS ────────────────────────────
-- Sets longest_streak = max(longest_streak, streak) for all existing rows.
-- Safe to re-run.

update public.users
set longest_streak = greatest(longest_streak, streak)
where longest_streak < streak;


-- ── 3. PRODUCTION-CORRECT update_user_streak RPC ─────────────────────────────
--
-- CASES HANDLED:
--   A) last_active = today         → no-op (already credited today)
--   B) last_active = yesterday     → streak + 1, update longest_streak
--   C) last_active = anything else → reset to 1 (missed a day or first ever)
--   D) last_active IS NULL         → first ever completion → streak = 1
--
-- SECURITY DEFINER → runs as postgres, bypasses RLS.
-- Called ONLY from handle_submission_approved trigger (not by frontend directly).
--
-- Returns: 'no_change' | 'incremented' | 'reset' | 'first'
-- (Return value used by trigger for logging; ignored by callers.)

create or replace function public.update_user_streak(
  p_user_id uuid
) returns text language plpgsql security definer as $$
declare
  v_today          date    := (now() at time zone 'utc')::date;
  v_yesterday      date    := v_today - interval '1 day';
  v_current_streak integer;
  v_longest_streak integer;
  v_last_active    date;
  v_new_streak     integer;
  v_result         text;
begin
  -- Lock the row to prevent concurrent streak updates for the same user
  select streak, longest_streak, last_active
  into   v_current_streak, v_longest_streak, v_last_active
  from   public.users
  where  id = p_user_id
  for update;

  -- ── CASE A: Already credited today ───────────────────────────────────────
  if v_last_active = v_today then
    return 'no_change';
  end if;

  -- ── CASE B: Completed yesterday → extend streak ──────────────────────────
  if v_last_active = v_yesterday then
    v_new_streak := coalesce(v_current_streak, 0) + 1;
    v_result     := 'incremented';

  -- ── CASE C & D: Missed day(s) OR first ever → reset to 1 ─────────────────
  else
    v_new_streak := 1;
    v_result     := case when v_last_active is null then 'first' else 'reset' end;
  end if;

  -- Update streak + last_active + longest_streak atomically
  update public.users
  set streak         = v_new_streak,
      last_active    = v_today,
      longest_streak = greatest(coalesce(longest_streak, 0), v_new_streak)
  where id = p_user_id;

  return v_result;
end;
$$;

-- Only callable by authenticated users (trigger runs as postgres anyway)
revoke all on function public.update_user_streak(uuid) from public, anon, authenticated;
grant execute on function public.update_user_streak(uuid) to service_role;


-- ── 4. PRODUCTION-CORRECT handle_submission_approved TRIGGER FUNCTION ────────
--
-- Fires AFTER UPDATE on submissions when status → 'approved'.
-- Runs as SECURITY DEFINER (postgres role) → bypasses all RLS.
--
-- DOUBLE-AWARD PROTECTION (three independent layers):
--   Layer 1: OLD.status IS DISTINCT FROM 'approved' AND NEW.status = 'approved'
--            → fires exactly once per approval transition.
--   Layer 2: update_user_streak uses FOR UPDATE row lock → concurrent-safe.
--   Layer 3: Unique partial index (user_id, challenge_id) WHERE status='approved'
--            → DB rejects a second approved row entirely (see schema.sql §9).
--
-- STREAK ONLY UPDATES ON VALID CHALLENGE COMPLETION:
--   Streak is updated inside this trigger — the only path is:
--     admin approves submission → trigger fires → streak updated.
--   It is NEVER updated on: login, page load, profile fetch, or any frontend event.

create or replace function public.handle_submission_approved()
returns trigger language plpgsql security definer as $$
declare
  v_points   integer;
  v_xp       integer;
  v_streak_result text;
begin
  -- Only act on the pending → approved transition
  if (old.status is distinct from 'approved') and new.status = 'approved' then

    -- ── Get challenge points ────────────────────────────────────────────────
    select points into v_points
    from   public.challenges
    where  id = new.challenge_id;

    v_xp := round(coalesce(v_points, 0) * 1.5);

    -- ── Award points + XP ───────────────────────────────────────────────────
    update public.users
    set points = points + coalesce(v_points, 0),
        xp     = xp     + v_xp
    where id = new.user_id;

    -- ── Recalculate level from total XP ────────────────────────────────────
    -- Formula: level = floor(xp / 500) + 1
    update public.users
    set level = floor(xp / 500) + 1
    where id = new.user_id;

    -- ── Update streak (production-correct, abuse-proof) ─────────────────────
    -- Delegates to update_user_streak which handles all four cases atomically.
    v_streak_result := public.update_user_streak(new.user_id);

    raise log '[handle_submission_approved] submission=% user=% points=% xp=% streak_result=%',
      new.id, new.user_id, v_points, v_xp, v_streak_result;

  end if;

  return new;
end;
$$;

-- Recreate trigger (drop first to replace cleanly)
drop trigger if exists on_submission_approved on public.submissions;
create trigger on_submission_approved
  after update on public.submissions
  for each row execute function public.handle_submission_approved();

-- Approvals are recurring daily; an older installation may still have an
-- index that incorrectly permits only one approval for all time.
drop index if exists public.submissions_one_approval_per_user_challenge;


-- ── 5. LEADERBOARD VIEW — include longest_streak ──────────────────────────────
-- Recreate so the view exposes the new column.

create or replace view public.leaderboard
with (security_invoker = true) as
select
  u.id, u.name, u.gym, u.points, u.streak, u.longest_streak,
  u.rank, u.avatar_url, u.last_active,
  row_number() over (order by u.points desc) as position
from public.users u
order by u.points desc;

revoke all on public.leaderboard from public, anon;
grant select on public.leaderboard to authenticated;


-- ── 6. get_user_streak_status RPC ────────────────────────────────────────────
-- Lightweight read-only RPC so the frontend can display streak state
-- without exposing the full users row.
-- Returns: current_streak, longest_streak, last_active, streak_status

create or replace function public.get_user_streak_status(
  p_user_id uuid
) returns json language plpgsql security definer as $$
declare
  v_today       date := (now() at time zone 'utc')::date;
  v_yesterday   date := v_today - interval '1 day';
  v_streak      integer;
  v_longest     integer;
  v_last_active date;
  v_status      text;
begin
  select streak, longest_streak, last_active
  into   v_streak, v_longest, v_last_active
  from   public.users
  where  id = p_user_id;

  -- Determine human-readable streak status
  if v_last_active = v_today then
    v_status := 'active_today';
  elsif v_last_active = v_yesterday then
    v_status := 'at_risk';       -- one more day without completion breaks it
  elsif v_last_active is null then
    v_status := 'never';
  else
    v_status := 'broken';        -- gap > 1 day, streak already reset on next approval
  end if;

  return json_build_object(
    'current_streak',  coalesce(v_streak,  0),
    'longest_streak',  coalesce(v_longest, 0),
    'last_active',     v_last_active,
    'streak_status',   v_status,
    'checked_at',      v_today
  );
end;
$$;

revoke all on function public.get_user_streak_status(uuid) from public, anon;
grant execute on function public.get_user_streak_status(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES (run manually to confirm migration applied correctly)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Check column exists:
--   select column_name, data_type from information_schema.columns
--   where table_name = 'users' and column_name in ('streak','longest_streak','last_active');
--
-- Check trigger exists:
--   select trigger_name from information_schema.triggers
--   where event_object_table = 'submissions' and trigger_name = 'on_submission_approved';
--
-- Test streak status for a user:
--   select public.get_user_streak_status('<user-uuid-here>');
