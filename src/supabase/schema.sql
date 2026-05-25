-- ─────────────────────────────────────────────────────────────────────────────
-- FitArena — Supabase Database Schema  (clean, canonical version)
-- Run this entire file in your Supabase SQL Editor:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- Safe to re-run against an existing database:
--   • Tables use CREATE TABLE IF NOT EXISTS
--   • Policies use DROP IF EXISTS before CREATE (no duplicate errors)
--   • Functions use CREATE OR REPLACE
--   • Triggers use DROP IF EXISTS before CREATE
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. USERS ─────────────────────────────────────────────────────────────────

create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text        not null default '',
  gym         text        not null default '',
  avatar_url  text,
  points      integer     not null default 0,
  xp          integer     not null default 0,
  level       integer     not null default 1,
  streak         integer     not null default 0,
  longest_streak integer     not null default 0,
  last_active    date,
  badges      text[]      not null default '{}',
  rank        text        not null default 'Rookie',
  is_admin    boolean     not null default false,
  created_at  timestamptz not null default now()
);

alter table public.users enable row level security;

-- SELECT
drop policy if exists "Users can view own profile"             on public.users;
drop policy if exists "Authenticated users can view all profiles" on public.users;
create policy "Users can view own profile"
  on public.users for select using (auth.uid() = id);
create policy "Authenticated users can view all profiles"
  on public.users for select using (auth.role() = 'authenticated');

-- Profiles are inserted only by the SECURITY DEFINER auth trigger.
drop policy if exists "Service role can insert users" on public.users;

-- No direct client UPDATE is allowed on users. Profile edits, rewards, and
-- earned points use narrow SECURITY DEFINER functions later in this file.
drop policy if exists "Users can update own profile"   on public.users;
drop policy if exists "Admins can update user points"  on public.users;


-- ── 2. AUTO-CREATE PROFILE ON SIGN-UP ────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.users (id, name, gym, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'gym',       ''),
    coalesce(new.raw_user_meta_data->>'avatar_url','')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── 3. CHALLENGES ────────────────────────────────────────────────────────────

create table if not exists public.challenges (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  type        text        not null check (type in ('Pushup','Deadlift','Squat','Plank','Attendance')),
  icon        text        not null default '💪',
  points      integer     not null default 100,
  color       text        not null default '#39FF14',
  description text,
  deadline    timestamptz,
  active      boolean     not null default true,
  created_by  uuid        references public.users(id),
  created_at  timestamptz not null default now()
);

alter table public.challenges enable row level security;

-- SELECT — regular users see active challenges only; admins see ALL
drop policy if exists "Authenticated can view active challenges" on public.challenges;
drop policy if exists "Admins can view all challenges"           on public.challenges;
create policy "Authenticated can view active challenges"
  on public.challenges for select
  using (active = true and auth.role() = 'authenticated');
create policy "Admins can view all challenges"
  on public.challenges for select
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and is_admin = true
    )
  );
-- (Supabase ORs all matching SELECT policies, so admins satisfy the second
--  policy and see inactive challenges too; non-admins only satisfy the first.)

-- INSERT / UPDATE / DELETE
drop policy if exists "Authenticated users can create challenges" on public.challenges;
drop policy if exists "Creator can update challenges"             on public.challenges;
drop policy if exists "Creator can delete challenges"             on public.challenges;
drop policy if exists "Admins can create challenges"              on public.challenges;
drop policy if exists "Admins can update challenges"              on public.challenges;
drop policy if exists "Admins can delete challenges"              on public.challenges;
create policy "Admins can create challenges"
  on public.challenges for insert
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and is_admin = true
    )
  );
create policy "Admins can update challenges"
  on public.challenges for update
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and is_admin = true
    )
  );
create policy "Admins can delete challenges"
  on public.challenges for delete
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and is_admin = true
    )
  );


-- ── 4. SUBMISSIONS ───────────────────────────────────────────────────────────
-- proof_url column removed — file upload feature is not used.

create table if not exists public.submissions (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.users(id)      on delete cascade,
  challenge_id    uuid        not null references public.challenges(id)  on delete cascade,
  score           integer     not null check (score > 0 and score <= 99999),
  status          text        not null default 'pending'
                                check (status in ('pending','approved','rejected')),
  submitted_at    timestamptz not null default now(),
  submission_date date generated always as ((submitted_at at time zone 'utc')::date) stored,
  unique (user_id, challenge_id, submission_date)
);

alter table public.submissions enable row level security;

-- SELECT — members see their own attempts; admins see the review queue.
drop policy if exists "Users can view own submissions"              on public.submissions;
drop policy if exists "Authenticated users can view all submissions" on public.submissions;
drop policy if exists "Admins can view all submissions" on public.submissions;
create policy "Users can view own submissions"
  on public.submissions for select using (auth.uid() = user_id);
create policy "Admins can view all submissions"
  on public.submissions for select using (
    exists (
      select 1 from public.users
      where id = auth.uid() and is_admin = true
    )
  );

-- UPDATE is reserved for the approve_submission/reject_submission RPCs.
drop policy if exists "Users can insert own submissions" on public.submissions;
drop policy if exists "Admins can update submission status" on public.submissions;


-- ── 5. LEADERBOARD VIEW ──────────────────────────────────────────────────────

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


-- ── 7. HELPER RPC: update_user_streak ────────────────────────────────────────
-- SECURITY DEFINER → runs as postgres, bypasses RLS.
-- Called ONLY from handle_submission_approved trigger — NEVER by the frontend.
--
-- CASES:
--   A) last_active = today     → no-op (already credited, CASE 2)
--   B) last_active = yesterday → streak + 1, update longest_streak (CASE 3)
--   C) last_active = other     → reset to 1 (CASE 4: missed days)
--   D) last_active IS NULL     → first ever → streak = 1 (CASE 1)
--
-- Uses FOR UPDATE row lock to be concurrent-safe.
-- Returns: 'no_change' | 'incremented' | 'reset' | 'first'

create or replace function public.update_user_streak(
  p_user_id uuid
) returns text language plpgsql security definer
set search_path = public as $$
declare
  v_today          date    := (now() at time zone 'utc')::date;
  v_yesterday      date    := v_today - interval '1 day';
  v_current_streak integer;
  v_longest_streak integer;
  v_last_active    date;
  v_new_streak     integer;
  v_result         text;
begin
  -- Lock row to prevent concurrent streak updates for the same user
  select streak, longest_streak, last_active
  into   v_current_streak, v_longest_streak, v_last_active
  from   public.users
  where  id = p_user_id
  for update;

  -- CASE 2: Already credited today — no-op
  if v_last_active = v_today then
    return 'no_change';
  end if;

  -- CASE 3: Completed yesterday — extend streak
  if v_last_active = v_yesterday then
    v_new_streak := coalesce(v_current_streak, 0) + 1;
    v_result     := 'incremented';
  -- CASE 1 & 4: First ever or missed day(s) — reset to 1
  else
    v_new_streak := 1;
    v_result     := case when v_last_active is null then 'first' else 'reset' end;
  end if;

  -- Atomic update: streak + last_active + longest_streak
  update public.users
  set streak         = v_new_streak,
      last_active    = v_today,
      longest_streak = greatest(coalesce(longest_streak, 0), v_new_streak)
  where id = p_user_id;

  return v_result;
end;
$$;

revoke all on function public.update_user_streak(uuid) from public, anon, authenticated;
grant execute on function public.update_user_streak(uuid) to service_role;


-- ── HELPER RPC: get_user_streak_status ───────────────────────────────────────
-- Read-only: returns streak info without exposing the full users row.

create or replace function public.get_user_streak_status(
  p_user_id uuid
) returns json language plpgsql security definer
set search_path = public as $$
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

  if v_last_active = v_today then
    v_status := 'active_today';
  elsif v_last_active = v_yesterday then
    v_status := 'at_risk';
  elsif v_last_active is null then
    v_status := 'never';
  else
    v_status := 'broken';
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


-- ── 8. TRIGGER: award points when a submission is approved ───────────────────
-- Fires AFTER UPDATE on submissions whenever status changes to 'approved'.
-- Runs as SECURITY DEFINER (postgres role) → bypasses all RLS.
-- This is the ONLY path that updates streaks. Streak is NEVER updated by
-- the frontend, login, page load, or any client-side event.
--
-- DUPLICATE/ABUSE PROTECTION:
--   • Fires only on OLD.status IS DISTINCT FROM 'approved' AND NEW.status = 'approved'
--     → exactly once per approval transition, never on re-reads or re-fetches.
--   • update_user_streak uses FOR UPDATE lock → concurrent-safe, no double-increment.
--   • submissions has one row per user/challenge/day, so the same challenge may
--     award points again on a later day without duplicate awards on one day.

create or replace function public.handle_submission_approved()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_points        integer;
  v_xp            integer;
  v_streak_result text;
begin
  -- Only act on the pending → approved transition
  if (old.status is distinct from 'approved') and new.status = 'approved' then

    -- Get challenge points (runs as postgres, no RLS barrier)
    select points into v_points
    from   public.challenges
    where  id = new.challenge_id;

    v_xp := round(coalesce(v_points, 0) * 1.5);

    -- Award points + XP
    update public.users
    set points = points + coalesce(v_points, 0),
        xp     = xp     + v_xp
    where id = new.user_id;

    -- Recalculate level from total XP
    -- Formula: level = floor(xp / 500) + 1
    update public.users
    set level = floor(xp / 500) + 1
    where id = new.user_id;

    -- Update streak (production-correct, concurrent-safe, abuse-proof)
    -- Delegates all logic to update_user_streak which handles all 4 cases atomically.
    v_streak_result := public.update_user_streak(new.user_id);

    raise log '[on_submission_approved] submission=% user=% points=% xp=% streak=%',
      new.id, new.user_id, v_points, v_xp, v_streak_result;

  end if;

  return new;
end;
$$;

drop trigger if exists on_submission_approved on public.submissions;
create trigger on_submission_approved
  after update on public.submissions
  for each row execute function public.handle_submission_approved();


-- Remove the former all-time approval index. The table's daily unique
-- constraint is the correct duplicate boundary for recurring challenges.
drop index if exists public.submissions_one_approval_per_user_challenge;


-- ── 10. MAKE A USER AN ADMIN ─────────────────────────────────────────────────
-- Run this separately in the SQL editor, substituting the real UUID:
--
--   update public.users set is_admin = true where id = '<paste-uuid-here>';
--
-- To find the UUID: Auth → Users in the Supabase dashboard.


-- ── 11. BACKFILL LEVEL FOR EXISTING USERS ────────────────────────────────────
-- Run this once in the Supabase SQL Editor to fix users who already have XP
-- but are still stuck at level 1 because the trigger didn't exist yet.
-- Safe to re-run — it's a plain UPDATE with no side effects.
--
-- Formula: level = floor(xp / 500) + 1
-- Level 1 = 0–499 XP │ Level 2 = 500–999 XP │ Level 3 = 1000–1499 XP …

update public.users
set level = floor(xp / 500) + 1;


-- ── UNLOCKED CHALLENGES ───────────────────────────────────────────────────────
-- Records when a user has legitimately scanned a challenge QR code.
-- This is the server-side source of truth for unlock state.

create table if not exists public.unlocked_challenges (
  user_id      uuid not null references public.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  unlocked_at  timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

alter table public.unlocked_challenges enable row level security;

drop policy if exists "Users can view own unlocks" on public.unlocked_challenges;
drop policy if exists "Users can insert own unlocks" on public.unlocked_challenges;
drop policy if exists "Users can insert own unlocks for active challenges" on public.unlocked_challenges;

create policy "Users can view own unlocks"
  on public.unlocked_challenges for select
  using (auth.uid() = user_id);

-- No authenticated INSERT policy: /api/record-unlock verifies the QR token
-- and performs this write with a server-only service role key.

-- Admins can delete unlock records to revoke fraudulent unlocks or clean up
-- stale records for deactivated challenges.
drop policy if exists "Admins can delete unlocks" on public.unlocked_challenges;
create policy "Admins can delete unlocks"
  on public.unlocked_challenges for delete
  using (
    exists (
      select 1 from public.users
      where id = auth.uid()
        and is_admin = true
    )
  );

-- Users may only create today's pending score after the server has recorded an
-- unlock for an active challenge.
create policy "Users can insert own submissions"
  on public.submissions for insert with check (
    auth.uid() = user_id
    and status = 'pending'
    and submission_date = (now() at time zone 'utc')::date
    and exists (
      select 1
      from public.unlocked_challenges u
      join public.challenges c on c.id = u.challenge_id
      where u.user_id = auth.uid()
        and u.challenge_id = submissions.challenge_id
        and c.active = true
    )
  );

-- ── CHALLENGE STATS RPC ───────────────────────────────────────────────────────
-- Aggregates top score and participant count per challenge server-side,
-- avoiding a full-table fetch in getChallengeStats().
create or replace function public.get_challenge_stats()
returns table(challenge_id uuid, top_score integer, participant_count bigint)
language sql security definer
set search_path = public as $$
  select
    challenge_id,
    max(score)               as top_score,
    count(distinct user_id)  as participant_count
  from public.submissions
  where status = 'approved'
  group by challenge_id;
$$;
revoke all on function public.get_challenge_stats() from public, anon;
grant execute on function public.get_challenge_stats() to authenticated;

-- ── REDEMPTIONS ───────────────────────────────────────────────────────────────
-- Tracks which rewards each user has redeemed. The unique(user_id, reward_id)
-- constraint prevents double-redemption at the DB level.
create table if not exists public.redemptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  reward_id     text not null,
  redeemed_at   timestamptz not null default now(),
  points_spent  integer not null,
  unique(user_id, reward_id)
);
alter table public.redemptions enable row level security;
drop policy if exists "Users can view own redemptions" on public.redemptions;
drop policy if exists "Users can insert own redemptions" on public.redemptions;
create policy "Users can view own redemptions"
  on public.redemptions for select using (auth.uid() = user_id);

-- Reward prices are server-owned data. Never trust the price sent by a browser.
create table if not exists public.rewards (
  id          text primary key,
  title       text not null,
  cost        integer not null check (cost > 0),
  available   boolean not null default true
);

insert into public.rewards (id, title, cost, available) values
  ('r1', 'Free Protein Shake',        500,  true),
  ('r2', 'Personal Training Session', 2000, true),
  ('r3', 'Gym Merch Bundle',          1500, false),
  ('r4', 'Month Free Membership',     5000, true)
on conflict (id) do update set
  title = excluded.title,
  cost = excluded.cost,
  available = excluded.available;

alter table public.rewards enable row level security;
drop policy if exists "Authenticated users can view rewards" on public.rewards;
create policy "Authenticated users can view rewards"
  on public.rewards for select using (auth.role() = 'authenticated');

-- ── SAFE PROFILE UPDATE RPC ───────────────────────────────────────────────────
-- SECURITY: Client code must call this RPC instead of updating public.users
-- directly. Because it is SECURITY DEFINER it runs as the DB owner and can
-- only touch the three safe columns. Points, XP, level, and streak are never
-- accessible to callers regardless of what arguments they supply.
create or replace function public.update_user_profile(
  p_name       text,
  p_gym        text,
  p_avatar_url text
)
returns void language plpgsql security definer
set search_path = public as $$
begin
  update public.users
  set
    name       = coalesce(p_name,       name),
    gym        = coalesce(p_gym,        gym),
    avatar_url = coalesce(p_avatar_url, avatar_url)
  where id = auth.uid();
end;
$$;
revoke all on function public.update_user_profile(text, text, text) from public, anon;
grant execute on function public.update_user_profile(text, text, text) to authenticated;

-- Atomically redeem a catalog reward using its server-owned price.
drop function if exists public.redeem_reward(text, integer);
create or replace function public.redeem_reward(
  p_reward_id text
) returns json language plpgsql security definer
set search_path = public as $$
declare
  v_user_id   uuid := auth.uid();
  v_points    integer;
  v_cost      integer;
  v_available boolean;
begin
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'not_authenticated');
  end if;

  select cost, available into v_cost, v_available
  from public.rewards
  where id = p_reward_id;

  if not found or not v_available then
    return json_build_object('success', false, 'error', 'reward_unavailable');
  end if;

  select points into v_points
  from public.users
  where id = v_user_id
  for update;

  if v_points < v_cost then
    return json_build_object('success', false, 'error', 'insufficient_points');
  end if;

  if exists (
    select 1 from public.redemptions
    where user_id = v_user_id and reward_id = p_reward_id
  ) then
    return json_build_object('success', false, 'error', 'already_redeemed');
  end if;

  update public.users set points = points - v_cost where id = v_user_id;
  insert into public.redemptions (user_id, reward_id, points_spent)
  values (v_user_id, p_reward_id, v_cost);

  return json_build_object('success', true, 'new_balance', v_points - v_cost);
end;
$$;

revoke all on function public.redeem_reward(text) from public, anon;
grant execute on function public.redeem_reward(text) to authenticated;

-- Admin review is exposed only through narrow functions that can update status.
create or replace function public.approve_submission(
  p_submission_id uuid
) returns public.submissions language plpgsql security definer
set search_path = public as $$
declare
  v_submission public.submissions;
begin
  if not exists (
    select 1 from public.users where id = auth.uid() and is_admin = true
  ) then
    raise exception 'ADMIN_REQUIRED: Admin access required.';
  end if;

  if exists (
    select 1 from public.submissions
    where id = p_submission_id and user_id = auth.uid()
  ) then
    raise exception 'SELF_APPROVAL: You cannot approve your own submission.';
  end if;

  update public.submissions
  set status = 'approved'
  where id = p_submission_id and status = 'pending'
  returning * into v_submission;

  if v_submission.id is null then
    raise exception 'ALREADY_PROCESSED: This submission has already been processed.';
  end if;

  return v_submission;
end;
$$;

create or replace function public.reject_submission(
  p_submission_id uuid
) returns public.submissions language plpgsql security definer
set search_path = public as $$
declare
  v_submission public.submissions;
begin
  if not exists (
    select 1 from public.users where id = auth.uid() and is_admin = true
  ) then
    raise exception 'ADMIN_REQUIRED: Admin access required.';
  end if;

  if exists (
    select 1 from public.submissions
    where id = p_submission_id and user_id = auth.uid()
  ) then
    raise exception 'SELF_REJECTION: You cannot reject your own submission.';
  end if;

  update public.submissions
  set status = 'rejected'
  where id = p_submission_id and status = 'pending'
  returning * into v_submission;

  if v_submission.id is null then
    raise exception 'ALREADY_PROCESSED: This submission has already been processed.';
  end if;

  return v_submission;
end;
$$;

revoke all on function public.approve_submission(uuid) from public, anon;
revoke all on function public.reject_submission(uuid) from public, anon;
grant execute on function public.approve_submission(uuid) to authenticated;
grant execute on function public.reject_submission(uuid) to authenticated;

create index if not exists submissions_user_id_idx on public.submissions(user_id);
create index if not exists submissions_challenge_id_idx on public.submissions(challenge_id);
create index if not exists submissions_pending_idx on public.submissions(submitted_at)
  where status = 'pending';
create index if not exists users_points_desc_idx on public.users(points desc);
