-- Per-tool results for the Clarity speech-to-text benchmark.
-- The API uses the service role; client access remains disabled by RLS.

create table if not exists public.clarity_benchmark_entries (
  id uuid primary key default gen_random_uuid(),
  tool_id text not null,
  tool_name text not null,
  prompt_type text not null,
  prompt_text text not null,
  transcript text not null,
  clarity_score smallint not null,
  punctuation_score smallint not null,
  created_at timestamptz not null default now(),
  constraint clarity_tool_id_len check (char_length(trim(tool_id)) between 2 and 48),
  constraint clarity_tool_name_len check (char_length(trim(tool_name)) between 2 and 48),
  constraint clarity_prompt_text_len check (char_length(trim(prompt_text)) between 10 and 1600),
  constraint clarity_transcript_len check (char_length(trim(transcript)) between 1 and 6000),
  constraint clarity_score_valid check (clarity_score between 0 and 100),
  constraint punctuation_score_valid check (punctuation_score between 0 and 100)
);

create index if not exists clarity_benchmark_tool_created_idx
  on public.clarity_benchmark_entries (tool_id, created_at desc);

alter table public.clarity_benchmark_entries enable row level security;

create or replace view public.clarity_tool_leaderboard as
select
  tool_id,
  max(tool_name) as tool_name,
  round(avg(clarity_score))::smallint as clarity_score,
  round(avg(punctuation_score))::smallint as punctuation_score,
  count(*)::integer as run_count
from public.clarity_benchmark_entries
where created_at >= now() - interval '30 days'
group by tool_id
having count(*) >= 1
order by round(avg(clarity_score)) desc, round(avg(punctuation_score)) desc, count(*) desc;
