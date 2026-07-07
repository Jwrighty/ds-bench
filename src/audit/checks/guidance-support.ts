import { basename, extname } from "node:path";
import { isManifestCarrier } from "../manifest-carriers.ts";
import { escapeRegExp, type TextFile } from "../file-system.ts";

export type GuidanceSection = {
  relativePath: string;
  subject: string | null;
  content: string;
};

const GUIDANCE_EXTENSIONS = new Set([".md", ".mdx", ".json", ".ts", ".tsx"]);

export function getGuidanceFiles(files: TextFile[]): TextFile[] {
  return files.filter((file) => GUIDANCE_EXTENSIONS.has(extname(file.relativePath)) || isManifestCarrier(file.relativePath));
}

export function getGuidanceSections(files: TextFile[], components: string[]): GuidanceSection[] {
  return getGuidanceFiles(files).flatMap((file) => sectionsForFile(file, components));
}

export function hasWord(content: string, word: string): boolean {
  return new RegExp(`\\b${escapeRegExp(word)}\\b`).test(content);
}

function sectionsForFile(file: TextFile, components: string[]): GuidanceSection[] {
  const markdownSections = splitMarkdownSections(file, components);
  if (markdownSections.length > 0) {
    return markdownSections;
  }

  return [
    {
      relativePath: file.relativePath,
      subject: subjectFromPath(file.relativePath, components),
      content: file.content,
    },
  ];
}

function splitMarkdownSections(file: TextFile, components: string[]): GuidanceSection[] {
  if (![".md", ".mdx"].includes(extname(file.relativePath))) {
    return [];
  }

  const sections: GuidanceSection[] = [];
  const fileSubject = subjectFromPath(file.relativePath, components);
  let current: GuidanceSection | null = null;

  for (const line of file.content.split(/\r?\n/)) {
    const heading = /^(?<marks>#{1,6})\s+(?<text>.+?)\s*$/.exec(line);
    if (heading) {
      if (current) {
        sections.push(current);
      }

      const headingText = heading.groups?.text ?? "";
      current = {
        relativePath: file.relativePath,
        subject: subjectFromText(headingText, components) ?? fileSubject,
        content: line,
      };
      continue;
    }

    if (!current) {
      current = {
        relativePath: file.relativePath,
        subject: fileSubject,
        content: "",
      };
    }

    current.content += `\n${line}`;
  }

  if (current) {
    sections.push(current);
  }

  return sections;
}

function subjectFromPath(relativePath: string, components: string[]): string | null {
  const filename = basename(relativePath).replace(/\.(stories\.)?[A-Za-z0-9]+$/, "");
  return components.find((component) => component === filename) ?? null;
}

function subjectFromText(text: string, components: string[]): string | null {
  return components.find((component) => hasWord(text, component)) ?? null;
}
