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

/** 키워드 검색: 서로 다른 검색어를 많이 담은 조문 우선(제목 3점, 본문은 반복 상한), boostRules에 들면 가산.
 *  한 규정이 결과를 독점하지 않도록 규정당 perRule개까지만 상위에 올림 */
export function searchArts(q, { field = null, extra = [], boostRules = null, limit = 60, perRule = 8 } = {}) {
  const { arts } = loadAll();
  const terms = termsOf(q, extra);
  const re = termRegex(terms);
  if (!re) return { re, terms, hits: [] };
  const all = [];
  for (const x of arts) {
    if (field && x.r.field !== field) continue;
    const tm = x.a.title.match(re) || [];
    const bm = x.text.match(re) || [];
    if (!tm.length && !bm.length) continue;
    const distinct = new Set([...tm, ...bm].map((m) => m.replace(/\s+/g, ""))).size;
    let s = distinct * 4 + tm.length * 3 + Math.min(bm.length, 6) + ((x.r.name.match(re) || []).length ? 2 : 0);
    if (boostRules && boostRules.has(x.r.name)) s = s * 1.5 + 3;
    all.push({ x, s });
  }
  all.sort((p, q2) => q2.s - p.s);
  const per = new Map();
  const hits = [];
  const rest = [];
  for (const h of all) {
    const n = per.get(h.x.r.id) || 0;
    if (n < perRule) { per.set(h.x.r.id, n + 1); hits.push(h); } else rest.push(h);
    if (hits.length >= limit) break;
  }
  if (hits.length < limit) hits.push(...rest.slice(0, limit - hits.length));
  return { re, terms, hits };
}

/** AI에게 보낼 조문 발췌: 검색어가 들어간 줄을 우선 담아 max자까지 */
export function excerptOf(a, re, max = 700) {
  const hitLines = [], other = [];
  for (const l of a.lines) { re.lastIndex = 0; (re.test(l) ? hitLines : other).push(l); }
  let out = "";
  for (const l of [...hitLines, ...other]) { if (out.length + l.length > max) { if (!out) out = l.slice(0, max); break; } out += (out ? " " : "") + l; }
  return out;
}

/** 결과용 미리보기: 검색어가 처음 나오는 줄 */
export function snippetOf(a, re) {
  let line = a.lines[0] || "";
  if (re) { const f = a.lines.find((l) => { re.lastIndex = 0; return re.test(l); }); if (f) line = f; }
  return line.length > 160 ? line.slice(0, 160) + "…" : line;
}
