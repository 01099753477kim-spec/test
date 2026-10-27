# Supabase 연결

- 테이블: `schema.sql` (search_logs, feedback, draft_logs)
- Vercel 환경변수: Supabase ↔ Vercel 공식 연동으로 자동 등록 (`SUPABASE_URL`, `SUPABASE_SECRET_KEY` 등)
- 개인정보 미저장: 검색어(60자 이내), 신분, 시각만 기록
