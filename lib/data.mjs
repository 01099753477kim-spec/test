// 서버 전용: 빌드된 전체 조문을 메모리에 올려 검색
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { termsOf, termRegex, artKey } from "./rulecore.mjs";

let cache = null;
export function loadAll() {
  if (cache) return cache;
  const rules = JSON.parse(readFileSync(join(process.cwd(), "data", "built", "all.json"), "utf8"));
  const byId = new Map();
  const arts = [];
  for (const r of rules) {
    byId.set(r.id, r);
    for (const a of r.items) {
      if (a.type !== "art") continue;
      arts.push({ r, a, key: artKey(r.id, a.num), text: a.lines.join(" ") });
    }
  }
  cache = { rules, byId, arts };
  return cache;
}

/** 키워드 검색: 조문 제목 3점 + 본문 1점 + 규정명 일치 2점, boostRules(규정명 Set)에 들면 가산 */
export function searchArts(q, { field = null, extra = [], boostRules = null, limit = 60 } = {}) {
  const { arts } = loadAll();
  const terms = termsOf(q, extra);
  const re = termRegex(terms);
  if (!re) return { re, terms, hits: [] };
  const hits = [];
  for (const x of arts) {
    if (field && x.r.field !== field) continue;
    const t = (x.a.title.match(re) || []).length;
    const b = (x.text.match(re) || []).length;
    if (!t && !b) continue;
    let s = t * 3 + b + ((x.r.name.match(re) || []).length ? 2 : 0);
    if (boostRules && boostRules.has(x.r.name)) s = s * 1.5 + 3;
    hits.push({ x, s });
  }
  hits.sort((p, q2) => q2.s - p.s);
  return { re, terms, hits: hits.slice(0, limit) };
}

/** 결과용 미리보기: 검색어가 처음 나오는 줄 */
export function snippetOf(a, re) {
  let line = a.lines[0] || "";
  if (re) { const f = a.lines.find((l) => { re.lastIndex = 0; return re.test(l); }); if (f) line = f; }
  return line.length > 160 ? line.slice(0, 160) + "…" : line;
}
