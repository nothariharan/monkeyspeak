-- global leaderboard table

create table if not exists public.leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '🐵',
  wpm smallint not null,
  accuracy smallint not null,
  duration smallint not null,
  prompt_type text not null,
  created_at timestamptz not null default now(),
  constraint leaderboard_name_len check (char_length(trim(name)) between 2 and 18),
  constraint leaderboard_wpm_sane check (wpm between 1 and 250),
  constraint leaderboard_accuracy_sane check (accuracy between 0 and 100),
  constraint leaderboard_duration_valid check (duration in (15, 30, 60, 120))
);

create index if not exists leaderboard_board_rank_idx
  on public.leaderboard_entries (duration, prompt_type, wpm desc, accuracy desc, created_at desc);

alter table public.leaderboard_entries enable row level security;

-- no anon policies — api uses service role
