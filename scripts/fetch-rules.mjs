// 빌드 전 자동 실행: data/sources.txt 를 읽어 국가법령정보센터에서 현행 본문을 받아 data/rules/_auto_*.txt 로 저장
//  - "@기관 국방부 1290000" 줄: 그 기관의 현행 행정규칙 전체를 자동으로 가져옴 (분야는 규정명으로 자동 분류)
//  - "분야 | 키워드 | 링크" 줄: 해당 규정을 가져오고, 같은 규정이 기관 목록에도 있으면 이 줄의 분야·키워드를 우선 적용
// 실패한 규정은 경고만 남기고 건너뜁니다. 배포는 계속됩니다.
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { resolveBodyUrl, parseLawHtml, toRuleFile, listOrgRules, classify } from "../lib/lawfetch.mjs";

const root = process.cwd();
const rulesDir = join(root, "data", "rules");
const lines = readFileSync(join(root, "data", "sources.txt"), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const orgs = lines.filter((l) => l.startsWith("@기관")).map((l) => { const p = l.split(/\s+/); return { name: p[1], csq: p[2] }; });
const manual = lines.filter((l) => !l.startsWith("@")).map((l) => {
  const [field, keywords, link] = l.split("|").map((s) => s.trim());
  return { field, keywords: (keywords || "").split(",").map((s) => s.trim()).filter(Boolean), link };
}).filter((s) => s.link);

readdirSync(rulesDir).filter((f) => f.startsWith("_auto_")).forEach((f) => unlinkSync(join(rulesDir, f)));

const HEADERS = { "user-agent": "Mozilla/5.0 (rulecompass build)", "accept-language": "ko-KR,ko;q=0.9" };
async function req(url, init = {}, tries = 3) {
  for (let i = 1; ; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal, headers: { ...HEADERS, ...(init.headers || {}) } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      if (text.includes("서비스 이용에 불편을 드려서")) throw new Error("법령정보센터 오류 페이지");
      return text;
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    } finally { clearTimeout(t); }
  }
}
const get = (url) => req(url);
const post = (url, body) => req(url, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "x-requested-with": "XMLHttpRequest" } });

// 동시에 몇 개씩 처리 (법령정보센터에 부담을 주지 않도록 4개씩)
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

const done = new Map(); // 규정명 → 파일 내용 (중복 방지)
let fail = 0, empty = 0;
function save(doc, src) {
  const arts = doc.lines.filter((x) => /^제\s*\d+\s*조/.test(x)).length;
  if (!doc.name) throw new Error("규정명을 찾지 못함");
  if (arts === 0) { empty++; doc.lines = []; }
  const safe = doc.name.replace(/[\\/:*?"<>|\s·]/g, "").slice(0, 80);
  writeFileSync(join(rulesDir, `_auto_${safe}.txt`), toRuleFile(doc, src, arts === 0));
  done.set(doc.name, true);
  return arts;
}

// 1) 직접 지정한 규정 (분야·키워드 우선)
const manualByName = new Map();
await pool(manual, 4, async (src) => {
  try {
    const { url } = await resolveBodyUrl(src.link, get);
    const doc = parseLawHtml(await get(url));
    const arts = save(doc, src);
    manualByName.set(doc.name, src);
    console.log(`[수집] ${doc.name} (${doc.no}, 시행 ${doc.eff}) 조문 ${arts}개`);
  } catch (e) { fail++; console.warn(`[수집 실패] ${src.link} — ${e.message}`); }
});

// 2) 기관 전체 목록
for (const org of orgs) {
  let list = [];
  try { list = await listOrgRules(org.csq, post); } catch (e) { console.warn(`[목록 실패] ${org.name} — ${e.message}`); continue; }
  const todo = list.filter((x) => !done.has(x.name));
  console.log(`[목록] ${org.name} 현행 행정규칙 ${list.length}건 (새로 받을 것 ${todo.length}건)`);
  await pool(todo, 4, async (item) => {
    try {
      const link = `https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=${item.seq}&chrClsCd=010201`;
      const doc = parseLawHtml(await get(`https://www.law.go.kr/LSW/admRulLsInfoR.do?admRulSeq=${item.seq}`));
      if (!doc.name) doc.name = item.name;
      save(doc, { field: classify(doc.name), keywords: [], link });
    } catch (e) { fail++; console.warn(`[수집 실패] ${item.name} — ${e.message}`); }
  });
}
console.log(`[규정나침반] 자동 수집 완료: ${done.size}건 (본문이 첨부파일 형태 ${empty}건, 실패 ${fail}건)`);
