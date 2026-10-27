// 규정 파싱 · 키워드 검색 공용 로직 (서버/브라우저 공용)

const META_KEYS = {
  "규정명": "name", "종류": "kind", "분야": "field", "발령번호": "no", "발령일": "date",
  "시행일": "eff", "구분": "rev", "원문": "url", "키워드": "keywords", "비고": "note",
};

export const FIELDS = ["인사", "군수", "작전", "보안", "교육훈련", "정보통신", "법무", "기타"];

// 현장 말투 ↔ 규정 용어 (필요한 만큼 추가)
export const SYN = {
  "데이터센터": ["국방통합데이터센터"], "ISP": ["정보화전략계획"], "정보화전략계획": ["ISP"],
  "PMO": ["사업관리위탁기관"], "M&S": ["국방M&S체계"], "CIO": ["정보화책임관"],
  "정보시스템": ["국방정보시스템"], "국방정보화법": ["국방정보화 기반조성 및 국방정보자원관리에 관한 법률"],
  "휴대폰": ["핸드폰", "스마트폰", "휴대전화"], "핸드폰": ["휴대폰", "휴대전화"],
  "연가": ["휴가"], "휴가": ["연가"],
};

/** 규정 파일(머리말 + --- + 본문)을 객체로 */
export function parseRuleFile(text, id) {
  const [head, ...rest] = text.replace(/\r/g, "").split(/\n-{3,}\n/);
  const meta = { id, kind: "훈령", field: "기타", keywords: [] };
  head.split("\n").forEach((ln) => {
    const m = ln.match(/^\s*([^:：]+)\s*[:：]\s*(.*)$/);
    if (!m) return;
    const key = META_KEYS[m[1].trim()];
    if (!key) return;
    meta[key] = key === "keywords" ? m[2].split(",").map((s) => s.trim()).filter(Boolean) : m[2].trim();
  });
  const body = rest.join("\n---\n");
  return { ...meta, items: parseBody(body) };
}

const ART_RE = /^\s*(제\s*\d+\s*조(?:\s*의\s*\d+)?)\s*(?:\(([^)]*)\))?\s*(.*)$/;

/** 본문 → 장/절/조문 목록 */
export function parseBody(text) {
  const lines = text.replace(/\r/g, "").split("\n").map((s) => s.trim()).filter(Boolean);
  const items = [];
  let cur = null;
  for (const ln of lines) {
    if (/^제\s*\d+\s*(편|장)(\s|$)/.test(ln)) { items.push({ type: "chap", text: ln }); cur = null; continue; }
    if (/^제\s*\d+\s*(절|관)(\s|$)/.test(ln)) { items.push({ type: "sec", text: ln }); cur = null; continue; }
    if (/^제\s*\d+\s*조/.test(ln)) {
      const m = ln.match(ART_RE);
      if (m) {
        cur = { type: "art", num: m[1].replace(/\s+/g, ""), title: (m[2] || "").trim(), lines: [] };
        if (m[3]) cur.lines.push(m[3]);
        items.push(cur);
        continue;
      }
    }
    if (cur) cur.lines.push(ln);
  }
  return items;
}

export function lineClass(s) {
  if (/^[①-⑳]/.test(s)) return "hang";
  if (/^\d+\.\s/.test(s)) return "ho";
  if (/^[가-하]\.\s/.test(s)) return "mok";
  if (/^\d+\)\s/.test(s)) return "sub";
  return "";
}

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// 검색·강조에서 뺄 흔한 말
const STOP = new Set(["훈령", "규정", "예규", "지침", "법", "적용", "대상", "관련", "내용", "무엇", "뭐야", "뭔가요", "어떻게", "알려줘", "알려주세요", "있어", "있나요", "있는", "되나요", "돼", "해야", "하나요", "경우", "대해", "대한", "이", "그", "저", "수", "것", "및", "등", "또는", "다음", "각", "호", "조", "항"]);
// 조사·어미 떼기 (예: 데이터센터도 → 데이터센터)
const SUFFIX = ["에서는", "으로는", "이라도", "이에요", "인가요", "에서", "으로", "이야", "인가", "까지", "부터", "에게", "한테", "이나", "에는", "도", "는", "은", "이", "가", "을", "를", "에", "의", "로", "와", "과", "야", "나"];
function stem(t) {
  if (!/[가-힣]$/.test(t) || t.length < 3) return t;
  for (const s of SUFFIX) if (t.length - s.length >= 2 && t.endsWith(s)) return t.slice(0, -s.length);
  return t;
}

export function termsOf(q, extra = []) {
  const base = String(q || "").split(/[\s,?!.]+/).map((s) => stem(s.trim())).filter((s) => s.length > 0 && !STOP.has(s));
  const set = new Set([...base, ...extra.filter((x) => x && !STOP.has(x))]);
  [...set].forEach((t) => {
    (SYN[t] || []).forEach((x) => set.add(x));
    Object.keys(SYN).forEach((k) => { if (SYN[k].includes(t)) set.add(k); });
  });
  return [...set].filter((t) => t.length >= 2 || /[A-Za-z0-9]/.test(t));
}

/** 띄어쓰기가 달라도 맞도록 글자 사이 공백 허용 */
export function termRegex(terms) {
  const list = [...new Set(terms)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!list.length) return null;
  const parts = list.map((t) => [...t.replace(/\s+/g, "")].map(reEsc).join("\\s*"));
  return new RegExp("(" + parts.join("|") + ")", "gi");
}

export function scoreArt(a, re) {
  if (!re) return 0;
  const t = (a.title.match(re) || []).length;
  const b = (a.lines.join(" ").match(re) || []).length;
  return t * 3 + b;
}

export const artKey = (ruleId, num) => `${ruleId}#${num}`;

/** 키워드 검색: [{ruleId, num, score}] */
export function keywordSearch(rules, q, field, extraTerms = []) {
  const re = termRegex(termsOf(q, extraTerms));
  const hits = [];
  for (const r of rules) {
    if (field && r.field !== field) continue;
    const nameBonus = re && (r.name.match(re) || []).length ? 2 : 0;
    for (const a of r.items) {
      if (a.type !== "art") continue;
      const s = scoreArt(a, re);
      if (s > 0) hits.push({ ruleId: r.id, num: a.num, score: s + nameBonus });
    }
  }
  return hits.sort((x, y) => y.score - x.score);
}

/** 개인정보 입력 차단 (서버·브라우저 공용) */
export function sensitiveCheck(q) {
  const s = String(q || "");
  if (/\d{6}\s*-\s*[1-4]\d{6}/.test(s)) return "주민등록번호로 보이는 숫자가 있어 검색하지 않았습니다.";
  if (/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/.test(s)) return "전화번호로 보이는 숫자가 있어 검색하지 않았습니다.";
  if (/(^|[^\d])\d{2}-\d{6,8}([^\d]|$)/.test(s)) return "군번으로 보이는 숫자가 있어 검색하지 않았습니다.";
  if (s.length > 300) return "질문이 너무 깁니다. 300자 이내로 줄여 주세요. 문서 전체를 붙여넣지 마세요.";
  return null;
}

/* ---------- 신분별 맞춤 ---------- */
export const ROLES = ["병사", "부사관", "장교", "군무원", "공무직"];
const ROLE_RE = {
  병사: /병사|용사|기간병|훈련병|병\(|병의|병은|병이|병에게|병 휴가|병 휴대/,
  부사관: /부사관|하사|중사|상사|원사/,
  장교: /장교|위관|영관|장성|장교·준사관/,
  군무원: /군무원/,
  공무직: /공무직|무기계약|근로자/,
};
export const roleRegex = (role) => ROLE_RE[role] || null;
