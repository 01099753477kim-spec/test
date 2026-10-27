import { readFileSync } from "node:fs";
import { join } from "node:path";
import Portal from "./Portal";

export const dynamic = "force-static";

export default function Page() {
  // 브라우저에는 규정 목록(메타 정보)만 보내고, 조문은 필요할 때 /api/rule 로 불러옴
  const index = JSON.parse(readFileSync(join(process.cwd(), "data", "built", "index.json"), "utf8"));
  return <Portal rules={index} />;
}
