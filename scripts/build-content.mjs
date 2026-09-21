import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { marked } from "marked";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const POSTS_DIRECTORY = path.join(ROOT, "content", "posts");
const DIST_DIRECTORY = path.join(ROOT, "dist");
const HOME_PATH = path.join(DIST_DIRECTORY, "index.html");

const SERIES = [
  {
    name: "Paper Reading",
    description: "Breaking research into questions, evidence, methods, and reproducible judgment.",
  },
  {
    name: "Chip Design",
    description: "Notes on architecture, interconnects, verification, and performance trade-offs.",
  },
  {
    name: "Inspiration",
    description: "Unfinished ideas, useful analogies, failed attempts, and the next hypothesis.",
  },
];

marked.setOptions({ gfm: true, breaks: false });

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseFrontMatter(source, filePath) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) throw new Error(`Missing front matter: ${filePath}`);

  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    metadata[key] = value;
  }

  const required = ["title", "date", "series", "slug", "description"];
  for (const key of required) {
    if (!metadata[key]) throw new Error(`Missing front matter field "${key}": ${filePath}`);
  }
  if (!SERIES.some((entry) => entry.name === metadata.series)) {
    throw new Error(`Unsupported series "${metadata.series}": ${filePath}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date)) {
    throw new Error(`Date must use YYYY-MM-DD: ${filePath}`);
  }

  return {
    metadata: {
      author: "Kugai Chen",
      language: "en",
      ...metadata,
    },
    body: source
      .slice(match[0].length)
      .replace(/^(?:\r?\n)*# .*(?:\r?\n)+/, ""),
  };
}

function plainHeading(value) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();
}

function slugify(value, fallback) {
  const slug = plainHeading(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function extractHeadings(markdown) {
  const headings = [];
  const counts = new Map();
  const pattern = /^(#{2,3})\s+(.+)$/gm;
  let match;

  while ((match = pattern.exec(markdown)) !== null) {
    const title = plainHeading(match[2]);
    const base = slugify(title, `section-${headings.length + 1}`);
    const count = (counts.get(base) || 0) + 1;
    counts.set(base, count);
    headings.push({
      level: match[1].length,
      title,
      id: count === 1 ? base : `${base}-${count}`,
    });
  }
  return headings;
}

function renderMarkdown(markdown) {
  const headings = extractHeadings(markdown);
  let headingIndex = 0;
  let html = marked.parse(markdown);

  html = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (full, level, inner) => {
    const heading = headings[headingIndex++];
    if (!heading) return full;
    const id = escapeHtml(heading.id);
    return `<h${level} id="${id}"><a class="heading-anchor" href="#${id}" aria-label="Link to this section">#</a>${inner}</h${level}>`;
  });

  html = html.replace(
    /<p><img src="([^"]+)" alt="([^"]*)"(?: title="([^"]*)")?><\/p>/g,
    (_full, source, alt, title) =>
      `<figure><img src="${source}" alt="${alt}" loading="lazy">` +
      `<figcaption>${title || alt}</figcaption></figure>`,
  );

  html = html.replace(
    /<a href="(https?:\/\/[^\"]+)">/g,
    '<a class="external-reference" href="$1" target="_blank" rel="noreferrer">',
  );

  html = html.replace(
    /<blockquote>\s*<p>/,
    '<blockquote class="article-abstract"><p><span class="annotation-label">Abstract:</span> ',
  );

  return { html, headings };
}

function formatDate(date, style = "long") {
  const value = new Date(`${date}T00:00:00Z`);
  const options =
    style === "short"
      ? { month: "short", year: "numeric", timeZone: "UTC" }
      : { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat("en", options).format(value);
}

function renderToc(headings) {
  const sections = [];
  let currentSection = null;

  for (const heading of headings) {
    if (heading.level === 2) {
      currentSection = { ...heading, children: [] };
      sections.push(currentSection);
    } else if (heading.level === 3 && currentSection) {
      currentSection.children.push(heading);
    }
  }

  const items = sections
    .map((heading) => {
      const children = heading.children.length
        ? `<ul>${heading.children
            .map(
              (child) =>
                `<li><a href="#${escapeHtml(child.id)}">${escapeHtml(child.title)}</a></li>`,
            )
            .join("")}</ul>`
        : "";
      return `<li><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.title)}</a>${children}</li>`;
    })
    .join("\n");

  return `
        <nav class="article-toc" aria-label="Table of contents">
          <p class="toc-heading">Contents</p>
          <ul>${items}</ul>
        </nav>`;
}

function renderArticle(post) {
  const { metadata } = post;
  const { html, headings } = renderMarkdown(post.body);
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const author = escapeHtml(metadata.author);
  const series = escapeHtml(metadata.series);
  const language = escapeHtml(metadata.language);

  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#fdfcf9" />
    <meta name="description" content="${description}" />
    <title>${title} — ${author}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&amp;family=Noto+Serif+SC:wght@400;600&amp;family=Source+Sans+3:wght@400;500;600&amp;family=Source+Serif+4:ital,wght@0,400;0,600;1,400&amp;display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="../../styles.css" />
    <link rel="stylesheet" href="../../article.css" />
  </head>
  <body>
    <a class="skip-link" href="#article">Skip to article</a>
    <header class="site-header article-site-header">
      <a class="brand" href="../../">Kugai Chen</a>
      <nav class="article-nav" aria-label="Primary navigation">
        <a href="../../#series">Series</a>
        <a href="../../#connectionism">Connectionism</a>
      </nav>
    </header>

    <main class="article-page" id="article">
      <header class="article-hero">
        <p class="article-series">${series}</p>
        <h1>${title}</h1>
        <p class="article-byline"><span>${author}</span><time datetime="${metadata.date}">${formatDate(metadata.date)}</time></p>
      </header>
      <div class="post-content-shell">
${renderToc(headings)}
        <article class="article-body">
${html}
        </article>
      </div>
      <nav class="article-end" aria-label="Article navigation">
        <a href="../../#connectionism">Back to Connectionism</a>
        <a href="#article">Back to top</a>
      </nav>
    </main>

    <script>
      (() => {
        const toc = document.querySelector(".article-toc");
        const article = document.querySelector(".article-body");
        if (!toc || !article) return;

        const headings = [...article.querySelectorAll("h2[id], h3[id]")];
        const links = new Map(
          [...toc.querySelectorAll("a[href^='#']")].map((link) => [decodeURIComponent(link.hash.slice(1)), link]),
        );
        let previousLink = null;

        function updateCurrentSection() {
          const threshold = parseFloat(getComputedStyle(toc).top) + 24;
          let current = headings[0];

          for (const heading of headings) {
            if (heading.getBoundingClientRect().top <= threshold) current = heading;
            else break;
          }

          const currentLink = links.get(current?.id);
          for (const link of links.values()) {
            const active = link === links.get(current?.id);
            link.classList.toggle("is-current", active);
            if (active) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
          }

          if (currentLink && currentLink !== previousLink) {
            previousLink = currentLink;
            if (toc.scrollHeight > toc.clientHeight) {
              const targetTop = currentLink.offsetTop - (toc.clientHeight - currentLink.offsetHeight) / 2;
              const maxTop = toc.scrollHeight - toc.clientHeight;
              toc.scrollTo({
                top: Math.max(0, Math.min(targetTop, maxTop)),
                behavior: "smooth",
              });
            }
          }
        }

        let frame = null;
        function scheduleUpdate() {
          if (frame !== null) return;
          frame = requestAnimationFrame(() => {
            frame = null;
            updateCurrentSection();
          });
        }

        window.addEventListener("scroll", scheduleUpdate, { passive: true });
        window.addEventListener("resize", scheduleUpdate);
        updateCurrentSection();
      })();
    </script>

    <footer>
      <p class="footer-meta">@ 2026 Kugai Chen</p>
      <p class="footer-series">Paper Reading / Chip Design / Inspiration</p>
    </footer>
  </body>
</html>
`;
}

function renderSeries(posts) {
  return SERIES.map((series, index) => {
    const matchingPosts = posts.filter((post) => post.metadata.series === series.name);
    const newest = matchingPosts[0];
    const heading = newest
      ? `<a href="./blog/${escapeHtml(newest.metadata.slug)}/">${escapeHtml(series.name)}</a>`
      : escapeHtml(series.name);
    const count = matchingPosts.length
      ? `<span class="series-count">${matchingPosts.length} ${matchingPosts.length === 1 ? "essay" : "essays"}</span>`
      : "";

    return `          <article class="series-item">
            <p class="series-index">${String(index + 1).padStart(2, "0")}</p>
            <h3>${heading}</h3>
            <p>${escapeHtml(series.description)}${count}</p>
          </article>`;
  }).join("\n\n");
}

function renderConnectionism(posts) {
  return posts
    .map(
      (post) => `          <article class="post-item">
            <time datetime="${post.metadata.date}">${formatDate(post.metadata.date, "short")}</time>
            <div class="post-info">
              <h3><a href="./blog/${escapeHtml(post.metadata.slug)}/">${escapeHtml(post.metadata.title)}</a></h3>
              <p>${escapeHtml(post.metadata.description)}</p>
            </div>
          </article>`,
    )
    .join("\n\n");
}

function replaceGeneratedBlock(source, name, content) {
  const start = `<!-- content:${name}:start -->`;
  const end = `<!-- content:${name}:end -->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!pattern.test(source)) throw new Error(`Missing generated markers for ${name}`);
  return source.replace(pattern, `${start}\n${content}\n        ${end}`);
}

async function writeText(filePath, content, check) {
  if (check) {
    const current = await fs.readFile(filePath, "utf8").catch(() => null);
    if (current !== content) throw new Error(`Generated file is stale: ${path.relative(ROOT, filePath)}`);
    return;
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

function localImageReferences(markdown) {
  const references = [];
  const pattern = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = pattern.exec(markdown)) !== null) {
    const candidate = match[1].trim().replace(/^<|>$/g, "").split(/\s+["']/)[0];
    if (!/^(?:https?:|data:|\/)/i.test(candidate)) references.push(candidate);
  }
  return [...new Set(references)];
}

async function syncAssets(post, outputDirectory, check) {
  for (const reference of localImageReferences(post.body)) {
    const source = path.resolve(post.directory, reference);
    const destination = path.resolve(outputDirectory, reference);
    if (!source.startsWith(`${post.directory}${path.sep}`)) {
      throw new Error(`Image escapes post directory: ${reference}`);
    }
    if (!destination.startsWith(`${outputDirectory}${path.sep}`)) {
      throw new Error(`Image escapes output directory: ${reference}`);
    }

    const sourceStat = await fs.stat(source).catch(() => null);
    if (!sourceStat?.isFile()) throw new Error(`Missing image: ${source}`);

    if (check) {
      const destinationStat = await fs.stat(destination).catch(() => null);
      if (!destinationStat?.isFile() || destinationStat.size !== sourceStat.size) {
        throw new Error(`Generated image is stale: ${path.relative(ROOT, destination)}`);
      }
      continue;
    }

    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
  }
}

async function loadPosts() {
  const entries = await fs.readdir(POSTS_DIRECTORY, { withFileTypes: true });
  const posts = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(POSTS_DIRECTORY, entry.name);
    const filePath = path.join(directory, "index.md");
    const source = await fs.readFile(filePath, "utf8").catch(() => null);
    if (source === null) continue;
    const parsed = parseFrontMatter(source, filePath);
    posts.push({ ...parsed, directory, filePath });
  }

  posts.sort((a, b) => b.metadata.date.localeCompare(a.metadata.date));
  const slugs = new Set();
  for (const post of posts) {
    if (slugs.has(post.metadata.slug)) throw new Error(`Duplicate slug: ${post.metadata.slug}`);
    slugs.add(post.metadata.slug);
  }
  return posts;
}

export async function buildSite({ check = false } = {}) {
  const posts = await loadPosts();
  if (!posts.length) throw new Error("No posts found in content/posts");

  for (const post of posts) {
    const outputDirectory = path.join(DIST_DIRECTORY, "blog", post.metadata.slug);
    await writeText(path.join(outputDirectory, "index.html"), renderArticle(post), check);
    await syncAssets(post, outputDirectory, check);
  }

  let home = await fs.readFile(HOME_PATH, "utf8");
  home = replaceGeneratedBlock(home, "series", renderSeries(posts));
  home = replaceGeneratedBlock(home, "connectionism", renderConnectionism(posts));
  await writeText(HOME_PATH, home, check);

  console.log(`${check ? "Checked" : "Built"} ${posts.length} post${posts.length === 1 ? "" : "s"}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildSite({ check: process.argv.includes("--check") }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
