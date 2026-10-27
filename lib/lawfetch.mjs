// 국가법령정보센터 원문 HTML → 규정나침반 규정 파일(.txt) 변환 (빌드 시 자동 수집용)
const BASE = "https://www.law.go.kr";

const ENT = { "&nbsp;": " ", "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&middot;": "·" };
export function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z#0-9]+;/gi, (m) => ENT[m] ?? m);
}
const strip = (h) => decode(h.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const hidden = (html, id) => (html.match(new RegExp(`id="${id}"[^>]*value="([^"]*)"`)) || [])[1];

/** 링크 → 본문(R) 주소 */
export async function resolveBodyUrl(link, get) {
  const u = new URL(link, BASE);
  const q = u.searchParams;
  const isLaw = /(^|\/)lsInfo[PR]\.do$/.test(u.pathname) || !!q.get("lsId") || !!q.get("lsiSeq");
  if (isLaw) {
    const p = await get(`${BASE}/lsInfoP.do?${q.get("lsId") ? "lsId=" + q.get("lsId") : "lsiSeq=" + q.get("lsiSeq")}&ancYnChk=0`);
    const lsiSeq = hidden(p, "lsiSeq") || q.get("lsiSeq");
    const efYd = (p.match(/efYd\s*=\s*'(\d{8})/) || [])[1] || "";
    return { kind: "law", url: `${BASE}/lsInfoR.do?lsiSeq=${lsiSeq}&efYd=${efYd}&efYn=Y&chrClsCd=010202&ancYnChk=0&netPrivateYn=N` };
  }
  // 한글 주소(/행정규칙/규정명) 등 번호가 없는 링크는 페이지에서 번호를 찾음
  if (!q.get("admRulId") && !q.get("admRulSeq")) {
    const page = await get(u.href);
    const seq0 = (page.match(/admRulSeq=(\d{6,})/) || [])[1];
    const ls0 = (page.match(/lsiSeq=(\d{4,})/) || [])[1];
    if (!seq0 && ls0) return resolveBodyUrl(`${BASE}/lsInfoP.do?lsiSeq=${ls0}`, get);
    if (!seq0) throw new Error("링크에서 규정 번호를 찾지 못함");
    q.set("admRulSeq", seq0);
  }
  // 행정규칙: 항상 현행본을 쓰도록 admRulId로 최신 admRulSeq를 다시 찾음
  let id = q.get("admRulId");
  if (!id && q.get("admRulSeq")) {
    const r0 = await get(`${BASE}/LSW/admRulLsInfoR.do?admRulSeq=${q.get("admRulSeq")}`);
    id = hidden(r0, "admRulId");
  }
  let seq = q.get("admRulSeq");
  if (id) {
    const p = await get(`${BASE}/admRulLsInfoP.do?admRulId=${id}&efYd=0`);
    seq = hidden(p, "admRulSeq") || seq;
  }
  return { kind: "admrul", url: `${BASE}/LSW/admRulLsInfoR.do?admRulSeq=${seq}` };
}

/** 본문 HTML → {name, no, date, eff, rev, dept, lines[]} */
export function parseLawHtml(html) {
  const h2 = (html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || "";
  const name = hidden(html, "admNm") || strip(h2.replace(/<span[\s\S]*?<\/span>/g, ""));
  const stampRaw = strip((html.match(/class="(?:subtit1|ct_sub)"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "");
  const m = stampRaw.match(/\[시행\s*([^\]]+?)\]\s*\[([^,\]]+),\s*([^,\]]+),\s*([^\]]+)\]/);
  const deptRaw = strip((html.match(/class="(?:subtit2|cont_subtit)"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "");
  const start = Math.max(html.indexOf('id="conScroll"'), 0);
  let end = html.indexOf('id="arDivArea"');
  if (end < 0) end = html.length;
  const body = html.slice(start, end);
  const lines = [];
  for (const p of body.matchAll(/<p\s+class="(gtit|pty[^"]*)"[^>]*>([\s\S]*?)<\/p>/g)) {
    const t = strip(p[2]);
    if (t) lines.push(t);
  }
  return {
    name: decode(name).trim(),
    eff: m ? m[1].trim() : "", no: m ? m[2].trim() : "", date: m ? m[3].trim() : "", rev: m ? m[4].trim() : "",
    dept: deptRaw.replace(/\s*\d{2,3}-\d{3,4}-\d{4}.*$/, "").replace(/[,\s]+$/, "").trim(),
    lines,
  };
}

export function kindOf(no) {
  const k = (no.match(/(훈령|예규|지시|고시|지침|법률|대통령령|국방부령|총리령)/) || [])[1] || "훈령";
  return { 대통령령: "시행령", 국방부령: "시행규칙", 총리령: "시행규칙" }[k] || k;
}

export function toRuleFile(doc, src) {
  return [
    `규정명: ${doc.name}`,
    `종류: ${kindOf(doc.no)}`,
    `분야: ${src.field}`,
    `발령번호: ${doc.no}`,
    `발령일: ${doc.date}`,
    `시행일: ${doc.eff}`,
    `구분: ${doc.rev}`,
    `원문: ${src.link}`,
    `키워드: ${src.keywords.join(", ")}`,
    `비고: 국가법령정보센터 현행본 자동 수집${doc.dept ? " · 소관 " + doc.dept : ""}`,
    "---",
    ...doc.lines,
    "",
  ].join("\n");
}
