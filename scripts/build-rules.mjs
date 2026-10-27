// data/rules/*.txt → lib/rules.generated.json (빌드 전에 자동 실행)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { parseRuleFile } from "../lib/rulecore.mjs";

const dir = join(process.cwd(), "data", "rules");
const files = readdirSync(dir).filter((f) => f.endsWith(".txt")).sort();
const rules = files.map((f, i) => {
  const text = readFileSync(join(dir, f), "utf8");
  const nm = (text.match(/^규정명:\s*(.+)$/m) || [])[1] || f;
  let h = 5381; for (const ch of nm.trim()) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  const r = parseRuleFile(text, "r" + h.toString(36)); // 규정명 기준 고정 id (근거 바구니 유지)
  r.file = basename(f);
  if (!r.name) r.name = basename(f, ".txt");
  return r;
});
// 같은 규정이 자동 수집본(_auto_)과 직접 넣은 파일에 모두 있으면 자동 수집본(현행)을 사용
const autoNames = new Set(rules.filter((r) => r.file.startsWith("_auto_")).map((r) => r.name));
const final = rules.filter((r) => r.file.startsWith("_auto_") || !autoNames.has(r.name));
rules.length = 0; rules.push(...final);
writeFileSync(join(process.cwd(), "lib", "rules.generated.json"), JSON.stringify(rules));
const n = rules.reduce((s, r) => s + r.items.filter((i) => i.type === "art").length, 0);
console.log(`[규정나침반] 규정 ${rules.length}건, 조문 ${n}개를 불러왔습니다.`);
