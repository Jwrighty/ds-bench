export type ButtonProps = {
  label: string;
  data: any;
  metadata?: unknown;
};

export function Button(props: ButtonProps) {
  return props.label;
}
