// 최근 7일 전체 장병 검색 통계 (Supabase 연결 시)
import { supaSelect, supaOn } from "../../../lib/supa.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let memo = { t: 0, v: null };

export async function GET() {
  if (!supaOn()) return Response.json({ on: false });
  if (memo.v && Date.now() - memo.t < 60_000) return Response.json(memo.v);
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [logs, fb, drafts] = await Promise.all([
    supaSelect("search_logs", `select=q,role&created_at=gte.${since}&order=created_at.desc&limit=5000`),
    supaSelect("feedback", `select=vote&created_at=gte.${since}&limit=5000`),
    supaSelect("draft_logs", `select=id&created_at=gte.${since}&limit=5000`),
  ]);
  if (!logs) return Response.json({ on: false, error: true });
  const count = new Map();
  for (const { q } of logs) count.set(q, (count.get(q) || 0) + 1);
  const top = [...count.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => ({ k, n }));
  const up = (fb || []).filter((x) => x.vote === 1).length;
  const down = (fb || []).filter((x) => x.vote === -1).length;
  const v = { on: true, total: logs.length, top, up, down, drafts: (drafts || []).length };
  memo = { t: Date.now(), v };
  return Response.json(v);
}
