# 규정나침반

키워드나 질문 하나로 군 규정 근거를 찾는 검색 포털입니다. Gemini AI가 질문을 이해해 관련 조항을 고르고, 등록된 조항만 근거로 답합니다.

## 구성

| 경로 | 역할 |
| --- | --- |
| `data/rules/*.txt` | 규정 데이터 (파일 하나 = 규정 하나) |
| `app/Portal.js` | 검색 포털 화면 (메인 · 결과 · 법령정보센터형 상세 · 근거 바구니) |
| `app/api/search/route.js` | AI 검색 API (서버에서 Gemini 호출, 키는 브라우저에 노출되지 않음) |
| `app/admin/page.js` | 규정 등록 도우미 (본문 붙여넣기 → 규정 파일 생성) |
| `lib/rulecore.mjs` | 조문 파싱 · 키워드 검색 · 개인정보 차단 |

## 배포 (GitHub → Vercel)

1. 이 폴더를 GitHub 새 저장소에 올립니다.
2. Vercel → Add New → Project → 저장소 Import.
3. Environment Variables에 `GEMINI_API_KEY` 등록 (선택: `GEMINI_MODEL`, 기본 `gemini-3.5-flash-lite`).
4. Deploy. 이후 GitHub에 Commit할 때마다 자동 배포됩니다.

## 규정 추가

`/admin` 화면에서 파일을 만든 뒤 `data/rules/`에 올리고 Commit합니다. 파일 형식:

```
규정명: 국방 정보화업무 훈령
종류: 훈령
분야: 정보통신
발령번호: 국방부훈령 제3166호
발령일: 2026. 5. 28.
시행일: 2026. 5. 28.
구분: 일부개정
원문: https://www.law.go.kr/...
키워드: 데이터센터, 정보시스템
비고:
---
제1장 총 칙
제1조(목적) 이 훈령은 ...
```

## 로컬 실행

```
npm install
cp .env.example .env.local   # GEMINI_API_KEY 입력
npm run dev
```

## 다음 단계

- Supabase 연결: 규정 DB, 전체 사용자 기준 인기 검색어 순위, 관리자 로그인
- Gemini Embedding으로 의미 검색 추가
