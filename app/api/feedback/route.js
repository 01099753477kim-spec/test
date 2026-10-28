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
  const ok = await supaInsert("feedback", { q, vote, role: ROLES.includes(b.role) ? b.role : null, model: String(b.model || "").slice(0, 40) || null });
  return Response.json({ ok });
}

// 질문별 도움 됐어요/아쉬워요 누적 수 (띄어쓰기·물음표가 달라도 같은 질문으로 셈)
export async function GET(req) {
  const key = normQ(cleanQ(new URL(req.url).searchParams.get("q")));
  if (!key || !supaOn()) return Response.json({ up: 0, down: 0 });
  const rows = await supaSelect("feedback", `select=q,vote&order=created_at.desc&limit=10000`);
  const same = (rows || []).filter((r) => normQ(r.q) === key);
  const up = same.filter((r) => r.vote === 1).length;
  const down = same.filter((r) => r.vote === -1).length;
  return Response.json({ up, down }, { headers: { "cache-control": "no-store" } });
}
