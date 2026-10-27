// AI 검색 API: 키워드 후보 → Gemini가 관련 조항 선별 + 근거 인용 답변
import rules from "../../../lib/rules.generated.json";
import { keywordSearch, sensitiveCheck, artKey } from "../../../lib/rulecore.mjs";

export const runtime = "nodejs";

const MODELS = [process.env.GEMINI_MODEL || "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
const cache = new Map(); // 같은 질문 반복 시 무료 한도 절약

const SYSTEM = `너는 대한민국 국군 장병을 돕는 '규정나침반' 검색 도우미다.
규칙:
1. 반드시 ARTICLES 목록에 있는 조문만 근거로 쓴다. 목록에 없는 규정·조문·숫자를 지어내지 않는다.
2. related에는 질문과 직접 관련된 조문 id를 관련도 높은 순서로 최대 8개 넣고, reason은 왜 관련 있는지 한 줄로 쓴다.
3. answer는 한국어 존댓말 2~5문장. 각 문장 끝에 근거를 [규정명 제N조] 형식으로 붙인다.
4. 근거가 없으면 answer를 "등록된 규정에서 근거를 찾지 못했습니다. 다른 키워드로 검색하거나 행정 담당자에게 확인하세요."로 하고 related는 빈 배열, confidence는 "낮음".
5. keywords에는 질문을 규정에 쓰이는 용어로 바꾼 검색어 3~8개를 넣는다(예: 핸드폰 → 휴대전화).
6. confidence는 근거가 질문에 정확히 답하면 "높음", 일부만 답하면 "보통", 아니면 "낮음".`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    keywords: { type: "ARRAY", items: { type: "STRING" } },
    related: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { id: { type: "STRING" }, reason: { type: "STRING" } }, required: ["id", "reason"] },
    },
    answer: { type: "STRING" },
    confidence: { type: "STRING", enum: ["높음", "보통", "낮음"] },
  },
  required: ["keywords", "related", "answer", "confidence"],
};

function buildCatalog(q, field) {
  const pool = rules.filter((r) => !field || r.field === field);
  const all = pool.flatMap((r) => r.items.filter((i) => i.type === "art").map((a) => ({ r, a })));
  const hits = keywordSearch(pool, q, null);
  const top = new Set(hits.slice(0, 40).map((h) => artKey(h.ruleId, h.num)));
  // 조문이 많으면 키워드 상위 + 제목만 목록으로 (토큰 절약)
  const chosen = all.length <= 300 ? all : all.filter(({ r, a }) => top.has(artKey(r.id, a.num))).concat(all.slice(0, 200));
  let budget = 60000;
  const lines = [];
  for (const { r, a } of chosen) {
    const id = artKey(r.id, a.num);
    const len = top.has(id) ? 400 : 120;
    const body = a.lines.join(" ").slice(0, len);
    const line = `[${id}] ${r.name} | ${a.num}(${a.title}) | ${body}`;
    budget -= line.length;
    if (budget < 0) break;
    lines.push(line);
  }
  return { text: lines.join("\n"), hits };
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error("GEMINI_API_KEY가 설정되지 않았습니다."), { code: "nokey" });
  let lastErr;
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: SCHEMA },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const txt = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}";
      return { ...JSON.parse(txt), model };
    }
    lastErr = Object.assign(new Error(`Gemini ${model} 오류 ${res.status}`), { status: res.status, detail: (await res.text()).slice(0, 300) });
    if (![404, 429, 500, 503].includes(res.status)) break; // 다른 모델로 넘겨볼 만한 오류만 재시도
  }
  throw lastErr;
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "잘못된 요청입니다." }, { status: 400 }); }
  const q = String(body.q || "").trim();
  const field = body.field || null;
  if (!q) return Response.json({ error: "검색어를 입력하세요." }, { status: 400 });
  const blocked = sensitiveCheck(q);
  if (blocked) return Response.json({ error: blocked, blocked: true }, { status: 400 });

  const cacheKey = `${field || ""}|${q}`;
  if (cache.has(cacheKey)) return Response.json({ ...cache.get(cacheKey), cached: true });

  const { text, hits } = buildCatalog(q, field);
  const valid = new Set(rules.flatMap((r) => r.items.filter((i) => i.type === "art").map((a) => artKey(r.id, a.num))));

  try {
    const ai = await callGemini(`질문: ${q}\n분야 필터: ${field || "전체"}\n\nARTICLES:\n${text}`);
    const related = (ai.related || []).filter((x) => valid.has(x.id)).slice(0, 8)
      .map((x) => { const [ruleId, num] = x.id.split("#"); return { ruleId, num, reason: x.reason }; });
    const result = {
      ai: { answer: ai.answer, confidence: ai.confidence, keywords: ai.keywords || [], related, model: ai.model },
      hits: hits.slice(0, 50),
    };
    if (cache.size > 300) cache.clear();
    cache.set(cacheKey, result);
    return Response.json(result);
  } catch (e) {
    const notice = e.code === "nokey"
      ? "AI 키가 설정되지 않아 키워드 검색 결과만 보여줍니다. Vercel 환경변수 GEMINI_API_KEY를 확인하세요."
      : e.status === 429
        ? "오늘 AI 무료 사용 한도에 도달해 키워드 검색 결과만 보여줍니다."
        : "AI 응답에 실패해 키워드 검색 결과만 보여줍니다.";
    console.error("[search]", e.message, e.detail || "");
    return Response.json({ ai: null, hits: hits.slice(0, 50), notice });
  }
}
