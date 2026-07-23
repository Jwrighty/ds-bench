import { CommentWidget, KeyWidget, StringWidget, UnusedWidget, Widget } from ".";
import type { WidgetOptions } from ".";

const options: WidgetOptions = { label: "Example" };
// CommentWidget is intentionally mentioned without using its binding.
export const note = "StringWidget is intentionally mentioned without using its binding.";
export const metadata = { KeyWidget: "An object key does not read the imported binding." };
export const Primary = {
  render: () => <Widget {...options} />,
};
