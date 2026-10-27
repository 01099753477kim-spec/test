// Gemini 호출 (서버 전용). 키는 Vercel 환경변수 GEMINI_API_KEY
const MODELS = () => [process.env.GEMINI_MODEL || "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

export async function gemini(system, prompt, schema, temperature = 0.2) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error("GEMINI_API_KEY가 설정되지 않았습니다."), { code: "nokey" });
  let lastErr;
  for (const model of MODELS()) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature, responseMimeType: "application/json", responseSchema: schema },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const txt = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}";
      return { ...JSON.parse(txt), model };
    }
    lastErr = Object.assign(new Error(`Gemini ${model} 오류 ${res.status}`), { status: res.status, detail: (await res.text()).slice(0, 300) });
    if (![404, 429, 500, 503].includes(res.status)) break;
  }
  throw lastErr;
}

export function aiNotice(e) {
  if (e.code === "nokey") return "AI 키가 설정되지 않아 키워드 검색 결과만 보여줍니다. Vercel 환경변수 GEMINI_API_KEY를 확인하세요.";
  if (e.status === 429) return "오늘 AI 무료 사용 한도에 도달해 키워드 검색 결과만 보여줍니다.";
  return "AI 응답에 실패해 키워드 검색 결과만 보여줍니다.";
}
