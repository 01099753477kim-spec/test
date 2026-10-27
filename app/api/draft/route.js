// 공문 초안 API: 근거 바구니의 조항 + 공문 목적 → "1. 관련 근거" 다음 본문을 Gemini가 작성
import { loadAll } from "../../../lib/data.mjs";
import { sensitiveCheck, ROLES } from "../../../lib/rulecore.mjs";
import { gemini, aiNotice } from "../../../lib/gemini.mjs";
import { supaInsert } from "../../../lib/supa.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `너는 대한민국 국군 부대의 공문(행정문서) 작성 도우미다. 사용자가 고른 근거 조항과 공문 목적으로 본문 초안을 쓴다.
규칙:
1. "1. 관련 근거"는 이미 들어가 있으니 쓰지 않는다. 본문은 lines 배열에 한 줄씩 넣고, 첫 줄은 반드시 "2."로 시작한다.
2. 2항은 "위 근거에 의거 ~하고자 하오니 ~하여 주시기 바랍니다." 형태의 목적 문장으로 쓴다.
3. 필요하면 2항 아래에 가./나./다. 하위 항목으로 세부 내용(일시, 대상, 내용, 행정사항 등)을 개조식(~함, ~임)으로 쓴다. 항목 기호는 1. → 가. → 1) → 가) 순서이고, 항목마다 lines의 새 줄로 쓰며 하위 항목은 앞에 공백을 두 칸씩 더 넣는다.
4. 근거 조항에 없는 의무나 숫자를 지어내지 않는다. 사용자가 주지 않은 날짜·인원·부대명·연락처는 "○○"으로 비워 둔다.
5. 마지막 줄 끝에 두 칸 띄우고 "끝."으로 마친다. 붙임이 필요하면 "붙임  ○○ 1부.  끝." 형식.
6. title은 명사형 공문 제목 (예: "2026년 하계 휴가 시행 계획 보고").
7. tips에는 보내기 전에 담당자가 확인할 점을 1~3개 짧게 쓴다.`;
const SCHEMA = {
  type: "OBJECT",
  properties: { title: { type: "STRING" }, lines: { type: "ARRAY", items: { type: "STRING" } }, tips: { type: "ARRAY", items: { type: "STRING" } } },
  required: ["title", "lines", "tips"],
};

export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "잘못된 요청입니다." }, { status: 400 }); }
  const purpose = String(b.purpose || "").trim();
  const to = String(b.to || "").trim().slice(0, 40);
  const cite = String(b.cite || "").trim().slice(0, 3000);
  const role = ROLES.includes(b.role) ? b.role : null;
  const items = Array.isArray(b.items) ? b.items.slice(0, 10) : [];
  if (!purpose) return Response.json({ error: "어떤 공문인지 한 줄로 적어 주세요." }, { status: 400 });
  if (!items.length || !cite) return Response.json({ error: "근거 바구니에 조항을 먼저 담아 주세요." }, { status: 400 });
  const blocked = sensitiveCheck(purpose) || (to && sensitiveCheck(to));
  if (blocked) return Response.json({ error: blocked }, { status: 400 });
  if (purpose.length > 200) return Response.json({ error: "공문 목적은 200자 이내로 적어 주세요." }, { status: 400 });

  const { byId } = loadAll();
  const arts = items.map(({ ruleId, num }) => {
    const r = byId.get(String(ruleId));
    const a = r?.items.find((i) => i.type === "art" && i.num === num);
    return a ? `${r.name} ${a.num}(${a.title}): ${a.lines.join(" ").slice(0, 900)}` : null;
  }).filter(Boolean);
  if (!arts.length) return Response.json({ error: "담긴 조항을 찾지 못했습니다. 바구니를 비우고 다시 담아 주세요." }, { status: 400 });

  try {
    const ai = await gemini(SYSTEM, `공문 목적: ${purpose}\n수신: ${to || "○○"}\n작성자 신분: ${role || "미지정"}\n\n이미 들어간 1항:\n${cite}\n\n근거 조항 원문:\n${arts.join("\n")}`, SCHEMA, 0.3);
    let body = (Array.isArray(ai.lines) ? ai.lines : [String(ai.body || "")]).map((l) => String(l).replace(/\s+$/, "")).filter(Boolean).join("\n").trim();
    // 한 줄에 몰아 쓴 하위 항목(가. 나. / 1) 2)) 줄바꿈 보정
    body = body.replace(/(?<=\S)[ \t]+(?=[가-하]\.\s)/g, "\n  ").replace(/(?<=\S)[ \t]+(?=\d\)\s)/g, "\n    ").replace(/\n{2,}/g, "\n").replace(/\n\s*끝\.\s*$/, "  끝.");
    if (!/^2\./.test(body)) body = "2. " + body.replace(/^\d+\.\s*/, "");
    if (!/끝\.\s*$/.test(body)) body += "  끝.";
    const title = String(ai.title || purpose).trim();
    const draft = `수신  ${to || "○○○"}\n제목  ${title}\n\n${cite}\n${body}`;
    await supaInsert("draft_logs", { role, cites: items.length });
    return Response.json({ title, draft, tips: (ai.tips || []).slice(0, 3), model: ai.model });
  } catch (e) {
    console.error("[draft]", e.message, e.detail || "");
    return Response.json({ error: aiNotice(e).replace("키워드 검색 결과만 보여줍니다", "공문 초안을 만들지 못했습니다") }, { status: 503 });
  }
}
