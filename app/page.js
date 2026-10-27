import rules from "../lib/rules.generated.json";
import Portal from "./Portal";

export default function Page() {
  return <Portal rules={rules} />;
}
