/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 서버 함수에 빌드된 규정 데이터를 포함
  outputFileTracingIncludes: { "/api/**": ["./data/built/**"] },
};
export default nextConfig;
