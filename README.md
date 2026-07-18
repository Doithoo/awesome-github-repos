# Awesome GitHub Repositories

A searchable, responsive catalog of repositories starred by Doithoo. The public UI is in English and the catalog updates daily.

[Live site](https://doithoo.github.io/awesome-github-repos/) | [Source](https://github.com/Doithoo/awesome-github-repos) | [MIT License](LICENSE)

## 中文

### 项目简介

本项目以 Graphic Signal 视觉风格展示 Doithoo 收藏的 GitHub 仓库。界面使用英文，支持搜索、语言筛选、快捷筛选、稳定排序、分页加载以及桌面和移动端布局。

### 架构与文件

- `index.html` 提供语义化页面结构，`styles.css` 定义响应式视觉系统。
- `app.js` 管理加载、筛选、排序与分页状态。
- `lib/catalog.mjs` 负责数据标准化和查询，`lib/view.mjs` 使用安全 DOM API 渲染内容。
- `data.json` 是浏览器读取的分组数据，`data.md` 是自动生成的 Markdown 目录。
- `scripts/update-awesome-list.mjs` 从 GitHub API 读取星标并原子更新两个数据文件。
- `.github/workflows/main.yml` 更新数据，`.github/workflows/static.yml` 测试并部署 GitHub Pages。

这种模块化结构将数据、状态和 DOM 渲染分离；页面只加载运行所需的静态资源和 JSON，减少有效载荷，并避免把外部数据作为 HTML 注入。

### 本地开发

CI 和自动化测试以 Node.js 22 为目标；本地开发请使用兼容的当前 Node.js 版本：

```bash
npm ci
npm run preview
```

预览地址为 `http://127.0.0.1:4173`。`npm run dev` 可在端口 3000 启动本地服务。所有服务命令使用 lockfile 中固定的本地 `serve` 依赖。

### 自动更新与部署

在仓库的 `Settings > Pages` 中将 Source 设为 GitHub Actions，并启用 Actions。`Update awesome list` 每天自动运行一次，也支持手动触发；更新通过测试后，其作用域受限的 `GITHUB_TOKEN` 提交 `data.json` 和 `data.md`。`Deploy static content to Pages` 在主分支更新后再次执行测试，使用最小权限的 Pages 写入权限和 OIDC 部署身份验证发布 GitHub Pages。

### API Token 安全

在 `Settings > Secrets and variables > Actions` 创建名为 `API_TOKEN` 的 Repository secret。根据 token 类型和 GitHub 界面，仅配置读取用户星标所需的最小用户级 `Starring: read` 只读权限；fine-grained PAT 不需要仓库内容、仓库写入、Workflow 或私有仓库访问权限。不要在代码、日志、截图或 issue 中暴露 token。

生成器会自动排除 API 意外返回的私有仓库，作为纵深防护；但 token 仍然不应具有任何私有仓库访问权限。`data.json` 和 `data.md` 的所有生成内容都会公开提交并由站点发布，因此请将任何生成输出视为公开信息。

### 测试

```bash
npm ci
npx playwright install chromium
npm run test:all
```

也可以分别运行 `npm test`（数据生成、目录逻辑、DOM 安全和工作流契约）与 `npm run test:e2e`（Chromium 中的搜索、筛选、排序、分页和响应式交互）。

### 许可证与上游致谢

项目采用 [MIT License](LICENSE)。许可证保留 2025 年原作者归属，并记录 2026 年 Doithoo 的修改归属。

## English

### Overview

This project presents Doithoo's starred GitHub repositories in a Graphic Signal interface. The English UI supports search, language and quick filters, stable sorting, paginated loading, and responsive desktop and mobile layouts. Catalog data updates daily.

### Features

- Search names, descriptions, topics, owners, and languages.
- Filter and sort without mutating source data.
- Accessible loading, empty, error, and retry states.
- Safe rendering through DOM APIs and an explicit URL policy.
- Automated catalog generation, CI checks, and GitHub Pages delivery.

### Architecture

- `index.html` and `styles.css`: semantic shell and responsive visual system.
- `app.js`: loading, filtering, sorting, and pagination controller.
- `lib/catalog.mjs`: data normalization and catalog queries.
- `lib/view.mjs`: safe DOM construction for repository content.
- `data.json` and `data.md`: generated browser data and Markdown catalog.
- `scripts/update-awesome-list.mjs`: authenticated star reader and atomic generator.
- `.github/workflows/main.yml` and `.github/workflows/static.yml`: update, test, and Pages automation.

The modular frontend keeps data, state, and rendering separate. The browser receives only the static application and catalog JSON, which reduces payload and keeps untrusted repository fields out of HTML string sinks.

### Local development

CI and automated tests target Node.js 22; use a compatible current Node.js release for local development:

```bash
npm ci
npm run preview
```

Open `http://127.0.0.1:4173`. `npm run dev` serves port 3000. The npm scripts resolve the lockfile-pinned local `serve` dependency.

### Update and deployment

Set `Settings > Pages > Source` to GitHub Actions and enable Actions. `Update awesome list` runs automatically every day and can also be dispatched manually. After its test gate, that workflow's scoped `GITHUB_TOKEN` commits refreshed `data.json` and `data.md`. Separately, `Deploy static content to Pages` repeats the test gate and uses least-privilege Pages write permission plus OIDC deployment authentication to publish the default branch.

### API token security

Create an Actions repository secret named `API_TOKEN`. Token types and GitHub UI labels can vary; configure only the minimum user-level `Starring: read` access required to read the user's stars. A fine-grained PAT needs no repository contents, repository write, Workflow, or private-repository access. Never expose the secret in source, logs, screenshots, issues, or build artifacts.

As defense in depth, the generator automatically excludes any private entry unexpectedly returned by the API. The token must still have no private-repository access. All generated output in `data.json` and `data.md` is publicly committed and published by the site, so treat every generated field as public information.

### Testing

```bash
npm ci
npx playwright install chromium
npm run test:all
```

Alternatively, run `npm test` for generation, catalog logic, safe rendering, structure, and workflow contracts, or `npm run test:e2e` for Chromium browser coverage.

### License and upstream credit

Licensed under the [MIT License](LICENSE). The license retains the original 2025 attribution and adds the 2026 Doithoo modification copyright.
