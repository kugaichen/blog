# Markdown 发布到博客

本仓库以 `content/posts/` 下的 Markdown 为内容源，通过构建脚本生成 `dist/` 静态网页，再由 GitHub Pages 发布。

## 1. 准备文章

每篇文章使用独立目录：

```text
content/posts/<slug>/
├── index.md
└── figures/
```

`index.md` 需要包含以下元数据：

```yaml
---
title: 文章标题
date: YYYY-MM-DD
series: Paper Reading
slug: article-slug
description: 用于首页和页面元数据的简短说明
author: Kugai Chen
language: zh-CN
---
```

`series` 只能使用：

- `Paper Reading`
- `Chip Design`
- `Inspiration`

本地图片放入文章目录的 `figures/`，并在 Markdown 中使用相对路径：

```markdown
![图片说明](figures/example.png)
```

## 2. 构建网页

首次使用时安装锁定的依赖：

```powershell
npm ci
```

生成文章页面、复制配图并更新首页：

```powershell
npm run build
```

确认生成结果与 Markdown 源文件一致：

```powershell
npm run build:check
```

生成的文章位于：

```text
dist/blog/<slug>/index.html
```

## 3. 本地预览

在仓库根目录启动静态文件服务：

```powershell
python -m http.server 8765 --bind 127.0.0.1 --directory dist
```

浏览器访问：

```text
http://127.0.0.1:8765/
```

发布前检查：

- 首页能进入新文章；
- 标题、目录、加粗和引用格式正确；
- 图片清晰且没有缺失；
- 桌面端和窄屏阅读正常；
- `npm run build:check` 通过。

## 4. 提交并发布

只暂存本次文章源文件、配图和对应的生成结果。例如：

```powershell
git add -- content/posts/your-article-slug dist/blog/your-article-slug dist/index.html
git diff --cached --check
git commit -m "Add article"
git push origin main
```

不要把论文原 PDF、阅读过程中的 PPT、私人对话记录、临时文件或未确认的素材目录一并提交。

推送到 `main` 后，`.github/workflows/deploy-pages.yml` 会自动：

1. 安装 npm 依赖；
2. 重新构建并检查内容；
3. 将 `dist/` 部署到 GitHub Pages。

在仓库的 [GitHub Actions](https://github.com/kugaichen/blog/actions) 页面确认部署成功，然后访问正式博客检查更新：

```text
https://kugaichen.github.io/blog/
```

## 5. 更新已有文章

直接修改对应的：

```text
content/posts/<slug>/index.md
```

然后重新执行：

```powershell
npm run build
npm run build:check
```

确认差异后，仅提交修改过的源文件和生成文件，再推送到 `main`。

完整的内容格式和导入脚本说明见 `CONTENT_WORKFLOW.md`。
