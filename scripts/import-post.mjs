import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "./build-content.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const POSTS_DIRECTORY = path.join(ROOT, "content", "posts");
const VALID_SERIES = new Set(["Paper Reading", "Chip Design", "Inspiration"]);

function parseArguments(values) {
  const result = { source: null };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--") && !result.source) {
      result.source = value;
      continue;
    }
    if (!value.startsWith("--")) throw new Error(`Unexpected argument: ${value}`);
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`Missing value for --${key}`);
    result[key] = next;
    index += 1;
  }
  return result;
}

function markdownTitle(source) {
  return source.match(/^#\s+(.+)$/m)?.[1]?.trim() || "Untitled";
}

function excerpt(source) {
  return (
    source
      .replace(/^---[\s\S]*?---\s*/, "")
      .replace(/^#{1,6}\s+.*$/gm, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`>|#-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180)
  );
}

function imageReferences(source) {
  const references = [];
  const pattern = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const candidate = match[1].trim().replace(/^<|>$/g, "").split(/\s+["']/)[0];
    if (!/^(?:https?:|data:|\/)/i.test(candidate)) references.push(candidate);
  }
  return [...new Set(references)];
}

const options = parseArguments(process.argv.slice(2));
if (!options.source || !options.series || !options.slug) {
  throw new Error(
    'Usage: npm run import:post -- "C:\\path\\post.md" --series "Chip Design" --slug "post-slug" [--title "Title"] [--date YYYY-MM-DD] [--description "Summary"]',
  );
}
if (!VALID_SERIES.has(options.series)) {
  throw new Error(`Series must be one of: ${[...VALID_SERIES].join(", ")}`);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.slug)) {
  throw new Error("Slug must contain lowercase letters, numbers, and single hyphens only.");
}

const sourcePath = path.resolve(options.source);
const sourceDirectory = path.dirname(sourcePath);
const source = await fs.readFile(sourcePath, "utf8");
const targetDirectory = path.join(POSTS_DIRECTORY, options.slug);
const targetPath = path.join(targetDirectory, "index.md");
const targetExists = await fs.stat(targetDirectory).then(() => true).catch(() => false);
if (targetExists) throw new Error(`Post already exists: ${targetDirectory}`);

const metadata = {
  title: options.title || markdownTitle(source),
  date: options.date || new Date().toISOString().slice(0, 10),
  series: options.series,
  slug: options.slug,
  description: options.description || excerpt(source),
  author: options.author || "Kugai Chen",
  language: options.language || "zh-CN",
};
const frontMatter = `---\n${Object.entries(metadata)
  .map(([key, value]) => `${key}: ${String(value).replaceAll("\n", " ")}`)
  .join("\n")}\n---\n\n`;

await fs.mkdir(targetDirectory, { recursive: true });
await fs.writeFile(targetPath, `${frontMatter}${source}`, "utf8");

for (const reference of imageReferences(source)) {
  const imageSource = path.resolve(sourceDirectory, reference);
  if (!imageSource.startsWith(`${sourceDirectory}${path.sep}`)) {
    throw new Error(`Image escapes source directory: ${reference}`);
  }
  const imageTarget = path.resolve(targetDirectory, reference);
  if (!imageTarget.startsWith(`${targetDirectory}${path.sep}`)) {
    throw new Error(`Image escapes target directory: ${reference}`);
  }
  await fs.mkdir(path.dirname(imageTarget), { recursive: true });
  await fs.copyFile(imageSource, imageTarget);
}

await buildSite();
console.log(`Imported ${options.slug} into ${path.relative(ROOT, targetPath)}.`);
