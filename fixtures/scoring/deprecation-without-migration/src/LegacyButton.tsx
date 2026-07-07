export type LegacyButtonProps = {
  children: string;
};

/**
 * @deprecated
 */
export function LegacyButton(props: LegacyButtonProps) {
  return <button>{props.children}</button>;
}
