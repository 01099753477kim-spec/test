import "./globals.css";

export const metadata = {
  title: "규정나침반",
  description: "키워드 하나로 군 규정 근거를 찾는 검색 포털",
};

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

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
