import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAuditContext } from "../src/audit/audit-context.ts";
import type { TextFile } from "../src/audit/file-system.ts";

function file(relativePath: string, content: string): TextFile {
  return { path: `/repo/${relativePath}`, relativePath, content };
}

describe("audit context", () => {
  it("exposes exported components by name", () => {
    const ctx = createAuditContext(
      [file("src/Button.tsx", "export function Button() { return null; }")],
      "/repo",
    );

    assert.deepEqual(ctx.components, ["Button"]);
  });

  it("passes through files and targetPath", () => {
    const files = [file("src/Button.tsx", "export function Button() {}")];
    const ctx = createAuditContext(files, "/repo");

    assert.equal(ctx.targetPath, "/repo");
    assert.equal(ctx.files, files);
  });

  it("memoizes each view — repeated access returns the identical reference", () => {
    const ctx = createAuditContext(
      [file("src/Button.tsx", "export function Button() {}")],
      "/repo",
    );

    assert.equal(ctx.components, ctx.components);
    assert.equal(ctx.exportedSymbols, ctx.exportedSymbols);
    assert.equal(ctx.tokenSources, ctx.tokenSources);
  });

  it("exposes all exported symbols with their kind", () => {
    const ctx = createAuditContext(
      [file("src/index.ts", "export function Button() {}\nexport type Size = 'sm' | 'lg';")],
      "/repo",
    );

    const button = ctx.exportedSymbols.find((symbol) => symbol.name === "Button");
    const size = ctx.exportedSymbols.find((symbol) => symbol.name === "Size");
    assert.equal(button?.kind, "value");
    assert.equal(size?.kind, "type");
  });

  it("exposes exported component symbols (value symbols named like components)", () => {
    const ctx = createAuditContext(
      [file("src/index.ts", "export function Button() {}\nexport const helper = 1;\nexport type Size = 'sm';")],
      "/repo",
    );

    assert.deepEqual(ctx.exportedComponentSymbols.map((symbol) => symbol.name), ["Button"]);
  });

  it("reports no public package when there is no package.json", () => {
    const ctx = createAuditContext(
      [file("src/Button.tsx", "export function Button() {}")],
      "/repo",
    );

    assert.equal(ctx.publicPackage, null);
  });

  it("derives guidance sections from guidance files", () => {
    const ctx = createAuditContext(
      [file("docs/Button.md", "# Button\n\nUse Button for primary actions.")],
      "/repo",
    );

    assert.equal(ctx.guidanceSections.length >= 1, true);
    assert.equal(ctx.guidanceSections[0].relativePath, "docs/Button.md");
  });

  it("derives token sources from a stylesheet's custom properties", () => {
    const ctx = createAuditContext(
      [file("styles.css", ":root { --color-primary: #fff; }")],
      "/repo",
    );

    const css = ctx.tokenSources.find((source) => source.kind === "css");
    assert.deepEqual(css?.tokenNames, ["color-primary"]);
  });
});
