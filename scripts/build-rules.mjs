// data/rules/*.txt → lib/rules.generated.json (빌드 전에 자동 실행)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { parseRuleFile } from "../lib/rulecore.mjs";

const dir = join(process.cwd(), "data", "rules");
const files = readdirSync(dir).filter((f) => f.endsWith(".txt")).sort();
const rules = files.map((f, i) => {
  const r = parseRuleFile(readFileSync(join(dir, f), "utf8"), "r" + (i + 1));
  r.file = basename(f);
  if (!r.name) r.name = basename(f, ".txt");
  return r;
});
writeFileSync(join(process.cwd(), "lib", "rules.generated.json"), JSON.stringify(rules));
const n = rules.reduce((s, r) => s + r.items.filter((i) => i.type === "art").length, 0);
console.log(`[규정나침반] 규정 ${rules.length}건, 조문 ${n}개를 불러왔습니다.`);
