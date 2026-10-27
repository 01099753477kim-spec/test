// 규정 하나의 전체 조문 (상세 화면에서 필요할 때만 불러옴)
import { loadAll } from "../../../lib/data.mjs";

export const runtime = "nodejs";

export async function GET(req) {
  const id = new URL(req.url).searchParams.get("id");
  const r = id && loadAll().byId.get(id);
  if (!r) return Response.json({ error: "규정을 찾지 못했습니다." }, { status: 404 });
  const { file, ...rule } = r;
  return Response.json(rule, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
