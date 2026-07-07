export type ButtonProps = {
  label: string;
  metadata?: Record<string, string>;
};

export function Button(props: ButtonProps) {
  return props.label;
}
