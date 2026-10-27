// data/rules/*.txt → data/built/index.json (목록, 브라우저로 보냄) + data/built/all.json (전체 조문, 서버 전용)
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { parseRuleFile } from "../lib/rulecore.mjs";

const root = process.cwd();
const dir = join(root, "data", "rules");
const out = join(root, "data", "built");
mkdirSync(out, { recursive: true });

const files = readdirSync(dir).filter((f) => f.endsWith(".txt")).sort();
let rules = files.map((f) => {
  const text = readFileSync(join(dir, f), "utf8");
  const nm = ((text.match(/^규정명:\s*(.+)$/m) || [])[1] || basename(f, ".txt")).trim();
  let h = 5381; for (const ch of nm) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  const r = parseRuleFile(text, "r" + h.toString(36)); // 규정명 기준 고정 id (근거 바구니 유지)
  r.file = basename(f);
  if (!r.name) r.name = nm;
  return r;
});
// 같은 규정이 자동 수집본(_auto_)과 직접 넣은 파일에 모두 있으면 자동 수집본(현행)을 사용
const autoNames = new Set(rules.filter((r) => r.file.startsWith("_auto_")).map((r) => r.name));
rules = rules.filter((r) => r.file.startsWith("_auto_") || !autoNames.has(r.name));
rules.sort((a, b) => a.name.localeCompare(b.name, "ko"));

const index = rules.map(({ items, file, ...meta }) => ({ ...meta, arts: items.filter((i) => i.type === "art").length }));
writeFileSync(join(out, "index.json"), JSON.stringify(index));
writeFileSync(join(out, "all.json"), JSON.stringify(rules));
const n = index.reduce((s, r) => s + r.arts, 0);
console.log(`[규정나침반] 규정 ${rules.length}건, 조문 ${n}개를 정리했습니다.`);
