# Content workflow

The site treats Markdown files as the source of truth. Generated HTML remains in `dist/` so the existing static hosting setup continues to work.

## Create a post inside the repository

Create `content/posts/<slug>/index.md` with this front matter:

```yaml
---
title: Your article title
date: 2026-09-21
series: Chip Design
slug: your-article-slug
description: A concise sentence used on the homepage and in metadata.
author: Kugai Chen
language: zh-CN
---
```

`series` must be exactly one of:

- `Paper Reading`
- `Chip Design`
- `Inspiration`

Keep local images inside the same post directory and reference them with relative Markdown paths.

## Import an existing local Markdown file

```powershell
npm run import:post -- "G:\path\article.md" --series "Chip Design" --slug "article-slug" --description "Short homepage summary"
```

The importer copies the Markdown file and every relative image it references, adds front matter, rebuilds the article page, and refreshes the homepage Series and Connectionism lists.

Optional flags are `--title`, `--date`, `--author`, and `--language`.

## Build and verify

```powershell
npm run build
npm run build:check
```

`npm run build` generates article pages under `dist/blog/`, copies referenced images, and updates the generated regions in `dist/index.html`. `npm run build:check` fails when committed output is stale.

## Commit and publish

```powershell
git add content scripts dist package.json package-lock.json CONTENT_WORKFLOW.md .github/workflows/deploy-pages.yml
git commit -m "Add article"
git push origin main
```

Pushing `main` triggers `.github/workflows/deploy-pages.yml`. GitHub Actions installs dependencies, rebuilds the Markdown content, verifies the generated files, and deploys `dist/` to:

```text
https://kugaichen.github.io/blog/
```

The deployment normally completes within a few minutes. Check the repository's **Actions** tab if the website does not update. The existing Sites project remains separate and is not updated by this GitHub workflow.
