// AI 답변 피드백(도움 됐어요 / 아쉬워요) 기록
import { ROLES, sensitiveCheck, normQ } from "../../../lib/rulecore.mjs";
import { supaInsert, supaSelect, supaOn, cleanQ } from "../../../lib/supa.mjs";

export const runtime = "nodejs";

export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "잘못된 요청입니다." }, { status: 400 }); }
  const vote = b.vote === 1 || b.vote === -1 ? b.vote : null;
  const q = cleanQ(b.q);
  if (!vote || !q || sensitiveCheck(q)) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  if (!supaOn()) return Response.json({ ok: false, off: true });
  const art = /^r[0-9a-z]{3,12}#제\d+조(의\d+)?$/.test(String(b.art || "")) ? b.art : null; // 답변의 대표 근거 조항
  const ok = await supaInsert("feedback", { q, vote, art, role: ROLES.includes(b.role) ? b.role : null, model: String(b.model || "").slice(0, 40) || null });
  return Response.json({ ok });
}

// 도움 됐어요/아쉬워요 누적 수
//  같은 근거 조항(예: 부대관리훈령 제35조의2)으로 답한 질문끼리 합산 → "병사 휴대폰~"과 "용사 휴대폰~"이 같은 숫자를 봄
//  근거 조항이 없으면 질문 문장(띄어쓰기·물음표 무시)으로 합산
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const key = normQ(cleanQ(sp.get("q")));
  const art = String(sp.get("art") || "");
  if ((!key && !art) || !supaOn()) return Response.json({ up: 0, down: 0 });
  const rows = await supaSelect("feedback", `select=q,vote,art&order=created_at.desc&limit=10000`);
  const same = (rows || []).filter((r) => (art && r.art === art) || (key && normQ(r.q) === key));
  const up = same.filter((r) => r.vote === 1).length;
  const down = same.filter((r) => r.vote === -1).length;
  return Response.json({ up, down }, { headers: { "cache-control": "no-store" } });
}
