-- 규정나침반 Supabase 테이블 (SQL Editor에 붙여넣고 Run)
-- 개인정보는 저장하지 않습니다: 검색어(민감정보 차단 후 60자 이내), 신분 구분, 시각만 기록.

create table if not exists public.search_logs (
  id bigint generated always as identity primary key,
  q text not null,
  field text,
  role text,
  created_at timestamptz not null default now()
);
create index if not exists search_logs_created_at_idx on public.search_logs (created_at desc);

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  q text not null,
  vote smallint not null check (vote in (-1, 1)),
  role text,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

create table if not exists public.draft_logs (
  id bigint generated always as identity primary key,
  role text,
  cites int,
  created_at timestamptz not null default now()
);

-- 브라우저(anon)에서는 접근 불가, 서버의 secret 키로만 읽고 씀
alter table public.search_logs enable row level security;
alter table public.feedback enable row level security;
alter table public.draft_logs enable row level security;
