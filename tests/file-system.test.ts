import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { join } from "node:path";
import { audit } from "../src/audit/audit.ts";
import { listTextFiles } from "../src/audit/file-system.ts";

const repoRoot = process.cwd();
const ignoredTreesFixturePath = join(repoRoot, "fixtures/file-discovery/ignored-generated-trees");

describe("file discovery", () => {
  it("skips generated and auxiliary trees while preserving source carriers", () => {
    const relativePaths = listTextFiles(ignoredTreesFixturePath)
      .map((file) => file.relativePath)
      .sort();

    assert.deepEqual(relativePaths, [
      "cedar.manifest.json",
      "package.json",
      "src/Button.stories.tsx",
      "src/Button.ts",
      "src/index.ts",
      "src/styles.css",
    ]);
  });

  it("keeps ignored generated trees out of audit findings", async () => {
    const report = await audit(ignoredTreesFixturePath);
    const serializedFindings = JSON.stringify(report.findings);

    assert.doesNotMatch(serializedFindings, /\.claude|\.next|\.worktrees|dist|storybook-static/);
    assert.doesNotMatch(serializedFindings, /\.scratch/);
    assert.doesNotMatch(serializedFindings, /GhostGenerated/);
    assert.equal(report.target.detectedCarriers.includes("CSS files"), true);
    assert.equal(report.target.detectedCarriers.includes("Storybook stories/MDX"), true);
    assert.equal(report.target.detectedCarriers.includes("manifests"), true);
  });
});
