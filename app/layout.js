import "./globals.css";

const SITE = "https://test-one-jade-34.vercel.app";
const DESC = "법률·훈령·예규를 키워드나 질문 하나로 찾고, AI가 근거 조항과 함께 답해 주는 군 규정 검색 포털 (공문 \"1. 관련 근거\" 자동 작성)";

export const metadata = {
  metadataBase: new URL(SITE),
  title: "규정나침반 | 궁금한 군 규정, 물어보면 바로",
  description: DESC,
  applicationName: "규정나침반",
  openGraph: { type: "website", url: SITE, siteName: "규정나침반", locale: "ko_KR", title: "규정나침반 | 궁금한 군 규정, 물어보면 바로", description: DESC },
  twitter: { card: "summary_large_image", title: "규정나침반 | 궁금한 군 규정, 물어보면 바로", description: DESC },
};

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#2F8F6B" };

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&family=Noto+Sans+KR:wght@400;500;600;700&family=Gowun+Batang:wght@400;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
