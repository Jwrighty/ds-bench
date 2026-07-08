import { Button } from "./Button.ts";

// Hardcoded values in a story file must NOT count against token discipline.
export const Default = () => <div style={{ width: "250px", background: "#123abc" }}>{Button()}</div>;
