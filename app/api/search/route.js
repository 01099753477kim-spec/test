// AI 검색 API (2단계)
//  1단계: Gemini가 질문을 규정 용어 검색어로 바꾸고, 전체 규정명 목록에서 관련 규정 후보를 고름
//  2단계: 서버가 전체 조문에서 검색 → 상위 조문만 Gemini에게 보여주고 근거 인용 답변 생성
import { loadAll, searchArts, snippetOf, excerptOf } from "../../../lib/data.mjs";
import { sensitiveCheck, artKey, ROLES, roleRegex } from "../../../lib/rulecore.mjs";
import { gemini, aiNotice } from "../../../lib/gemini.mjs";
import { supaInsert, cleanQ } from "../../../lib/supa.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

const cache = new Map(); // 같은 질문 반복 시 무료 한도 절약

const PLAN_SYSTEM = `너는 대한민국 국군 규정 검색 도우미다. 사용자의 질문을 분석한다.
1. keywords: 질문을 군 규정 조문에 실제로 쓰일 법령 용어로 바꾼 검색어 3~8개 (예: 핸드폰 → 휴대전화, 애인 면회 → 면회, 군대 그만두기 → 전역, 불참 → 받지 아니한). 처벌·불이익을 묻는 질문이면 벌칙, 징역, 벌금, 과태료, 징계도 넣는다. 질문자 신분이 주어지면 그 신분을 가리키는 조문 용어(예: 용사 → 병, 병사 / 부사관 / 장교 / 군무원)도 하나 넣는다.
2. rules: RULES 목록에서 답이 있을 가능성이 높은 규정명을 최대 6개, 목록의 이름 그대로. 처벌·의무·권리의 근본 근거는 법률·시행령에 있는 경우가 많으니 해당 법률이 목록에 있으면 포함한다.`;
const PLAN_SCHEMA = {
  type: "OBJECT",
  properties: { keywords: { type: "ARRAY", items: { type: "STRING" } }, rules: { type: "ARRAY", items: { type: "STRING" } } },
  required: ["keywords", "rules"],
};

const ANSWER_SYSTEM = `너는 대한민국 국군 장병을 돕는 '규정나침반' 검색 도우미다.
규칙:
1. 반드시 ARTICLES 목록에 있는 조문만 근거로 쓴다. 목록에 없는 규정·조문·숫자를 지어내지 않는다.
2. related에는 질문과 직접 관련된 조문 id를 관련도 높은 순서로 최대 8개 넣고, reason은 왜 관련 있는지 한 줄로 쓴다.
3. answer는 한국어 존댓말 2~5문장. 각 문장 끝에 근거를 [규정명 제N조] 형식으로 붙인다.
4. 질문자 신분이 주어지면 그 신분에 적용되는 조항을 우선 근거로 쓰고, 다른 신분에만 해당하는 내용이면 "(장교에 해당)"처럼 밝힌다.
5. 근거가 없으면 answer를 "등록된 규정에서 근거를 찾지 못했습니다. 다른 키워드로 검색하거나 행정 담당자에게 확인하세요."로 하고 related는 빈 배열, confidence는 "낮음".
6. confidence는 근거가 질문에 정확히 답하면 "높음", 일부만 답하면 "보통", 아니면 "낮음".`;
const ANSWER_SCHEMA = {
  type: "OBJECT",
  properties: {
    related: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { id: { type: "STRING" }, reason: { type: "STRING" } }, required: ["id", "reason"] },
    },
    answer: { type: "STRING" },
    confidence: { type: "STRING", enum: ["높음", "보통", "낮음"] },
  },
  required: ["related", "answer", "confidence"],
};

const toHit = (h, re) => ({ ruleId: h.x.r.id, num: h.x.a.num, title: h.x.a.title, snippet: snippetOf(h.x.a, re), score: Math.round(h.s) });

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "잘못된 요청입니다." }, { status: 400 }); }
  const q = String(body.q || "").trim();
  const field = body.field || null;
  const role = ROLES.includes(body.role) ? body.role : null;
  if (!q) return Response.json({ error: "검색어를 입력하세요." }, { status: 400 });
  const blocked = sensitiveCheck(q);
  if (blocked) return Response.json({ error: blocked, blocked: true }, { status: 400 });

  // 검색 통계 기록 (Supabase가 연결된 경우만, 응답을 기다리지 않음)
  const logged = supaInsert("search_logs", { q: cleanQ(q), field, role });

  const cacheKey = `${field || ""}|${role || ""}|${q}`;
  if (cache.has(cacheKey)) { await logged; return Response.json({ ...cache.get(cacheKey), cached: true }); }

  const { rules } = loadAll();
  const pool = rules.filter((r) => !field || r.field === field);
  let plan = { keywords: [], rules: [] };
  let notice = null;
  const who = role ? `\n질문자 신분: ${role}` : "";

  // 1단계: 질문 해석
  try {
    plan = await gemini(PLAN_SYSTEM, `질문: ${q}${who}\n\nRULES:\n${pool.map((r) => r.name).join("\n")}`, PLAN_SCHEMA);
  } catch (e) {
    notice = aiNotice(e);
    console.error("[plan]", e.message, e.detail || "");
  }
  const names = new Set(pool.map((r) => r.name));
  const boost = new Set((plan.rules || []).filter((n) => names.has(n)));
  const { re, hits } = searchArts(q, { field, extra: plan.keywords || [], boostRules: boost, limit: 60, roleRe: roleRegex(role) });

  // 후보 규정은 있는데 키워드 일치 조문이 적으면, 후보 규정의 조문 제목 목록도 함께 보여줌
  const extraTitles = [];
  if (boost.size && hits.length < 15) {
    for (const r of pool.filter((r) => boost.has(r.name))) {
      for (const a of r.items.filter((i) => i.type === "art").slice(0, 120)) extraTitles.push(`[${artKey(r.id, a.num)}] ${r.name} | ${a.num}(${a.title})`);
    }
  }
  const result = { hits: hits.map((h) => toHit(h, re)), ai: null, plan: { keywords: plan.keywords || [], rules: [...boost] }, role };

  // 2단계: 근거 인용 답변
  if (!notice) {
    const lines = hits.slice(0, 40).map((h) => `[${h.x.key}] ${h.x.r.name} | ${h.x.a.num}(${h.x.a.title}) | ${excerptOf(h.x.a, re)}`);
    const catalog = [...lines, ...extraTitles].join("\n").slice(0, 60000);
    if (!catalog) {
      result.ai = { answer: "등록된 규정에서 근거를 찾지 못했습니다. 다른 키워드로 검색하거나 행정 담당자에게 확인하세요.", confidence: "낮음", related: [], keywords: result.plan.keywords };
    } else {
      try {
        const ai = await gemini(ANSWER_SYSTEM, `질문: ${q}${who}\n분야 필터: ${field || "전체"}\n\nARTICLES:\n${catalog}`, ANSWER_SCHEMA);
        const { byId } = loadAll();
        const related = (ai.related || []).map((x) => {
          const [ruleId, num] = String(x.id).split("#");
          const a = byId.get(ruleId)?.items.find((i) => i.type === "art" && i.num === num);
          return a ? { ruleId, num, title: a.title, snippet: snippetOf(a, re), reason: x.reason } : null;
        }).filter(Boolean).slice(0, 8);
        result.ai = { answer: ai.answer, confidence: ai.confidence, related, keywords: result.plan.keywords, model: ai.model };
      } catch (e) {
        notice = aiNotice(e);
        console.error("[answer]", e.message, e.detail || "");
      }
    }
  }
  if (notice) result.notice = notice;
  else { if (cache.size > 300) cache.clear(); cache.set(cacheKey, result); }
  await logged;
  return Response.json(result);
}
