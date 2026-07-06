export type ExampleCarrierKind = {
  label: string;
  matches: (relativePath: string) => boolean;
};

// Single source of truth for the carriers that convey usage examples. Adding a
// new carrier here reaches every site that detects or enumerates them.
export const EXAMPLE_CARRIER_KINDS: ExampleCarrierKind[] = [
  {
    label: "Storybook stories/MDX",
    matches: (relativePath) => /\.stories\.[jt]sx?$/.test(relativePath) || relativePath.endsWith(".stories.mdx"),
  },
  {
    label: "examples dir",
    matches: (relativePath) => relativePath.startsWith("examples/"),
  },
  {
    label: "canonical-examples files",
    matches: (relativePath) => /canonical-examples/i.test(relativePath),
  },
];

export const EXAMPLE_CARRIER_LABELS: string[] = EXAMPLE_CARRIER_KINDS.map((kind) => kind.label);

export function isExampleCarrier(relativePath: string): boolean {
  return EXAMPLE_CARRIER_KINDS.some((kind) => kind.matches(relativePath));
}
