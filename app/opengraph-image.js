// 링크 공유 미리보기 이미지 (카카오톡·슬랙·문자 등에 URL을 붙이면 보이는 카드)
import { ImageResponse } from "next/og";

export const alt = "규정나침반 - 궁금한 군 규정, 물어보면 바로 찾아드려요";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const T = {
  brand: "규정나침반",
  h1a: "궁금한 군 규정,",
  h1b: "물어보면 바로",
  h1c: "찾아드려요",
  sub1: "법률·훈령·예규 322건, 조문 1만 2천여 개를",
  sub2: "AI가 근거 조항과 함께 찾아줘요",
  chips: ["AI 근거 답변", "공문 초안", "신분별 맞춤"],
  q: "휴대전화 몇 시까지 써?",
  go: "검색",
  ai: "AI 답변",
  ans1: "평일 과업 후 18:00~21:00, 휴무일",
  ans2: "08:30~21:00에 사용할 수 있어요.",
  cite: "부대관리훈령 제35조의2",
  tiles: ["인사", "군수", "보안"],
};
const ALL = Object.values(T).flat().join("");

// Google Fonts에서 필요한 글자만 받아옴 (빌드 시 1회)
async function loadFont(family, weight) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}${weight ? `:wght@${weight}` : ""}&text=${encodeURIComponent(ALL)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch { return null; }
}

const MASCOT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="58" r="46" fill="#fff" stroke="#2F8F6B" stroke-width="6"/><circle cx="60" cy="58" r="37" fill="#F2FAF5"/><g stroke="#2F8F6B" stroke-width="3" stroke-linecap="round" opacity=".55"><path d="M60 24v6M60 86v6M26 58h6M88 58h6"/></g><ellipse cx="47" cy="56" rx="4.5" ry="5.5" fill="#3B3A36"/><ellipse cx="73" cy="56" rx="4.5" ry="5.5" fill="#3B3A36"/><circle cx="48.5" cy="54" r="1.6" fill="#fff"/><circle cx="74.5" cy="54" r="1.6" fill="#fff"/><ellipse cx="39" cy="67" rx="6" ry="3.6" fill="#FFB4A8" opacity=".75"/><ellipse cx="81" cy="67" rx="6" ry="3.6" fill="#FFB4A8" opacity=".75"/><path d="M53 68q7 6 14 0" fill="none" stroke="#3B3A36" stroke-width="3" stroke-linecap="round"/><path d="M60 2 66 12H54z" fill="#FF8A7A"/></svg>`;
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M16 8.5 19 16h-6z" fill="#FF8A7A"/><path d="M16 23.5 13 16h6z" fill="#fff"/></svg>`;
const svgUri = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString("base64")}`;

export default async function Image() {
  const [jua, noto4, noto7] = await Promise.all([loadFont("Jua"), loadFont("Noto+Sans+KR", 400), loadFont("Noto+Sans+KR", 700)]);
  const fonts = [
    jua && { name: "Jua", data: jua, weight: 400, style: "normal" },
    noto4 && { name: "Noto", data: noto4, weight: 400, style: "normal" },
    noto7 && { name: "Noto", data: noto7, weight: 700, style: "normal" },
  ].filter(Boolean);
  const cute = jua ? "Jua" : "Noto";
  const chipDot = ["#2F8F6B", "#E2553F", "#6B4FD8"];
  const tile = [["#FFE8D9", "#D9622B"], ["#FFF3C4", "#A87A00"], ["#DDEEFF", "#2F6FD6"]];

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", position: "relative", background: "#FAF7F2", fontFamily: "Noto", color: "#2F2D2A" }}>
        <div style={{ position: "absolute", width: 420, height: 420, borderRadius: 420, background: "#E5F5EC", right: -60, top: -80 }} />
        <div style={{ position: "absolute", width: 260, height: 260, borderRadius: 260, background: "#FFE8D9", left: -80, bottom: -110 }} />

        <div style={{ position: "absolute", left: 72, top: 70, width: 640, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: cute, fontSize: 34 }}>
            <div style={{ width: 58, height: 58, borderRadius: 18, background: "#2F8F6B", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={svgUri(LOGO)} width={40} height={40} alt="" />
            </div>
            {T.brand}
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontFamily: cute, fontSize: 60, lineHeight: 1.2, marginTop: 34 }}>
            <span>{T.h1a}</span>
            <div style={{ display: "flex" }}><span style={{ color: "#2F8F6B" }}>{T.h1b}</span><span style={{ marginLeft: 16 }}>{T.h1c}</span></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 25, color: "#6E685F", marginTop: 20, lineHeight: 1.5 }}>
            <span>{T.sub1}</span><span>{T.sub2}</span>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 30 }}>
            {T.chips.map((c, i) => (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "2px solid #E7E0D4", borderRadius: 999, padding: "10px 20px", fontSize: 21, fontWeight: 700 }}>
                <div style={{ width: 12, height: 12, borderRadius: 12, background: chipDot[i] }} />{c}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "absolute", right: 64, top: 92, width: 420, height: 446, background: "#fff", border: "2px solid #EDE6DA", borderRadius: 34, padding: 30, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", border: "3px solid #2F8F6B", borderRadius: 999, padding: "10px 10px 10px 22px", fontSize: 19, color: "#8A8378" }}>
            <span>{T.q}</span>
            <span style={{ marginLeft: "auto", background: "#2F8F6B", color: "#fff", borderRadius: 999, padding: "8px 18px", fontSize: 18, fontWeight: 700 }}>{T.go}</span>
          </div>
          <div style={{ marginTop: 20, background: "#EEF8F2", borderRadius: 22, padding: "18px 20px", fontSize: 18, lineHeight: 1.55, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: cute, fontSize: 21, marginBottom: 6 }}><div style={{ width: 12, height: 12, borderRadius: 12, background: "#2F8F6B" }} />{T.ai}</div>
            <span>{T.ans1}</span><span>{T.ans2}</span>
            <div style={{ display: "flex", marginTop: 10 }}>
              <span style={{ background: "#fff", borderRadius: 999, padding: "4px 14px", fontSize: 16, fontWeight: 700, color: "#2F8F6B" }}>{T.cite}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            {T.tiles.map((t, i) => (
              <div key={t} style={{ width: 73, height: 62, borderRadius: 16, background: tile[i][0], color: tile[i][1], fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{t}</div>
            ))}
          </div>
        </div>
        <img src={svgUri(MASCOT)} width={130} height={130} alt="" style={{ position: "absolute", right: 80, top: 470, transform: "rotate(10deg)" }} />
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) }
  );
}
