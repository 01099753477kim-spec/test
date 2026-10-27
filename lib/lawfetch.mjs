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

export function toRuleFile(doc, src, attachOnly = false) {
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
    `비고: ${attachOnly ? "본문이 첨부파일(한글·PDF) 형태라 원문 링크에서 확인하세요" : "국가법령정보센터 현행본 자동 수집"}${doc.dept ? " · 소관 " + doc.dept : ""}`,
    "---",
    ...doc.lines,
    "",
  ].join("\n");
}

/** 국가법령정보센터 현행 행정규칙 목록 (기관코드 csq, 예: 국방부 1290000) → [{name, seq, stamp}] */
export async function listOrgRules(csq, post) {
  const out = [];
  for (let pg = 1; pg <= 20; pg++) {
    const body = `q=*&outmax=150&pg=${pg}&p6=2,3&section=admRulNm&admRulSeq=0&dtlYn=N&admType=N&p15=1,3&csq=${csq}`;
    const html = await post(`${BASE}/LSW/admRulScListR.do?menuId=5&subMenuId=41&tabMenuId=183`, body);
    const rows = [...html.matchAll(/title="([^"]+)"\s+onclick="javascript:showAdmRulCts\('(\d+)'/g)].map((m) => {
      const t = decode(m[1]).replace(/\s+/g, " ").trim();
      return { name: t.replace(/\s*\[시행.*$/, "").trim(), seq: m[2], stamp: t };
    });
    out.push(...rows);
    if (rows.length < 150) break;
  }
  return out;
}

// 규정명으로 분야 자동 분류 (앞의 규칙이 우선)
const FIELD_RULES = [
  ["보안", /보안|방첩|정보보호|사이버|비밀|개인정보/],
  ["정보통신", /정보화|정보통신|전산|데이터|정보시스템|전자|지식정보|M&S|모델링|주파수|통신|소프트웨어/],
  ["법무", /법제|법무|감사|소송|군사법원|군판사|군검사|수사|부패|공익신고|규제|송무|인권|재판|범죄|형사/],
  ["교육훈련", /교육|훈련|학교|사관|학생|연수|생도/],
  ["작전", /작전|경계|동원|예비군|예비전력|재난|대비|연합|비상|전시|위기|합동|대테러|안전/],
  ["군수", /군수|물자|장비|탄약|급식|피복|시설|재산|조달|정비|유류|획득|계약|예산|회계|재정|환경|폐기물|수송|정비|건설|부동산|국유/],
  ["인사", /인사|복무|병영|성희롱|성폭력|양성|군무원|보수|수당|휴가|진급|전역|상훈|복지|주거|관사|의무|건강|체력|장병|간부|공무직|상담|부대관리|징계|포상|여성|가족|보훈|유해|전사자|의료|병원/],
];
export function classify(name) {
  for (const [f, re] of FIELD_RULES) if (re.test(name)) return f;
  return "기타";
}
