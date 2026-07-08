import { Button } from "./Button.ts";

// Hardcoded values in a test file must NOT count against token discipline —
// tests are not the styling surface agents imitate.
export const testStyle = <div style={{ padding: "13px", color: "#abcdef" }}>{Button()}</div>;
