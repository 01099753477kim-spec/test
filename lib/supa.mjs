// Supabase REST(PostgREST) 호출 — 서버 전용. 키는 Vercel 환경변수에만 둡니다.
//   SUPABASE_URL          예: https://abcd1234.supabase.co
//   SUPABASE_SECRET_KEY   Supabase > Project Settings > API Keys 의 secret 키 (또는 service_role 키)
// 두 값이 없으면 기록·통계 기능만 조용히 꺼지고 나머지는 그대로 동작합니다.
const cfg = () => {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return url && key ? { url, key } : null;
};
export const supaOn = () => !!cfg();
const headers = (key, extra = {}) => ({ apikey: key, "content-type": "application/json", ...(key.startsWith("eyJ") ? { authorization: "Bearer " + key } : {}), ...extra });

export async function supaInsert(table, row) {
  const c = cfg(); if (!c) return false;
  try {
    const r = await fetch(`${c.url}/rest/v1/${table}`, { method: "POST", headers: headers(c.key, { prefer: "return=minimal" }), body: JSON.stringify(row) });
    if (!r.ok) console.error("[supabase insert]", table, r.status, (await r.text()).slice(0, 200));
    return r.ok;
  } catch (e) { console.error("[supabase insert]", e.message); return false; }
}

export async function supaSelect(table, query) {
  const c = cfg(); if (!c) return null;
  try {
    const r = await fetch(`${c.url}/rest/v1/${table}?${query}`, { headers: headers(c.key), cache: "no-store" });
    if (!r.ok) { console.error("[supabase select]", table, r.status, (await r.text()).slice(0, 200)); return null; }
    return await r.json();
  } catch (e) { console.error("[supabase select]", e.message); return null; }
}

/** 기록용 검색어 정리: 공백 정리, 60자 제한 */
export const cleanQ = (q) => String(q || "").replace(/\s+/g, " ").trim().slice(0, 60);
