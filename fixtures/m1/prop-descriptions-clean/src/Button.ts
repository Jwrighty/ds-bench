export type ButtonProps = {
  /** Visible button label. */
  label: string;
  /** Visual configuration for the button. */
  config?: {
    density: "compact" | "comfortable";
  };
};

export function Button(props: ButtonProps) {
  return props.label;
}
