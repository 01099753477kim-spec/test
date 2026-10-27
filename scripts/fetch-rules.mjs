// data/sources.txt 의 링크를 국가법령정보센터에서 받아 data/rules/_auto_*.txt 로 저장 (빌드 전에 자동 실행)
// 실패한 링크는 경고만 남기고 건너뜁니다. 배포는 계속됩니다.
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { resolveBodyUrl, parseLawHtml, toRuleFile } from "../lib/lawfetch.mjs";

const root = process.cwd();
const rulesDir = join(root, "data", "rules");
const sources = readFileSync(join(root, "data", "sources.txt"), "utf8")
  .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  .map((l) => {
    const [field, keywords, link] = l.split("|").map((s) => s.trim());
    return { field, keywords: (keywords || "").split(",").map((s) => s.trim()).filter(Boolean), link };
  })
  .filter((s) => s.link);

readdirSync(rulesDir).filter((f) => f.startsWith("_auto_")).forEach((f) => unlinkSync(join(rulesDir, f)));

async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (rulecompass build)", "accept-language": "ko-KR,ko;q=0.9" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      if (text.includes("서비스 이용에 불편을 드려서")) throw new Error("법령정보센터 오류 페이지");
      return text;
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i)); // 잠시 후 재시도
    } finally { clearTimeout(t); }
  }
}

let ok = 0;
for (const src of sources) {
  try {
    const { url } = await resolveBodyUrl(src.link, get);
    const doc = parseLawHtml(await get(url));
    const arts = doc.lines.filter((x) => /^제\s*\d+\s*조/.test(x)).length;
    if (!doc.name || arts === 0) throw new Error("조문을 찾지 못함");
    const safe = doc.name.replace(/[\\/:*?"<>|\s·]/g, "");
    writeFileSync(join(rulesDir, `_auto_${safe}.txt`), toRuleFile(doc, src));
    console.log(`[수집] ${doc.name} (${doc.no}, 시행 ${doc.eff}) 조문 ${arts}개`);
    ok++;
  } catch (e) {
    console.warn(`[수집 실패] ${src.link} — ${e.message}`);
  }
}
console.log(`[규정나침반] 자동 수집 ${ok}/${sources.length}건 완료`);
// data/sources.txt 의 링크를 국가법령정보센터에서 받아 data/rules/_auto_*.txt 로 저장 (빌드 전에 자동 실행)
// 실패한 링크는 경고만 남기고 건너뜁니다. 배포는 계속됩니다.
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { resolveBodyUrl, parseLawHtml, toRuleFile } from "../lib/lawfetch.mjs";

const root = process.cwd();
const rulesDir = join(root, "data", "rules");
const sources = readFileSync(join(root, "data", "sources.txt"), "utf8")
  .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  .map((l) => {
    const [field, keywords, link] = l.split("|").map((s) => s.trim());
    return { field, keywords: (keywords || "").split(",").map((s) => s.trim()).filter(Boolean), link };
  })
  .filter((s) => s.link);

readdirSync(rulesDir).filter((f) => f.startsWith("_auto_")).forEach((f) => unlinkSync(join(rulesDir, f)));

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (rulecompass build)", "accept-language": "ko-KR,ko;q=0.9" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } finally { clearTimeout(t); }
}

let ok = 0;
for (const src of sources) {
  try {
    const { url } = await resolveBodyUrl(src.link, get);
    const doc = parseLawHtml(await get(url));
    const arts = doc.lines.filter((x) => /^제\s*\d+\s*조/.test(x)).length;
    if (!doc.name || arts === 0) throw new Error("조문을 찾지 못함");
    const safe = doc.name.replace(/[\\/:*?"<>|\s·]/g, "");
    writeFileSync(join(rulesDir, `_auto_${safe}.txt`), toRuleFile(doc, src));
    console.log(`[수집] ${doc.name} (${doc.no}, 시행 ${doc.eff}) 조문 ${arts}개`);
    ok++;
  } catch (e) {
    console.warn(`[수집 실패] ${src.link} — ${e.message}`);
  }
}
console.log(`[규정나침반] 자동 수집 ${ok}/${sources.length}건 완료`);
