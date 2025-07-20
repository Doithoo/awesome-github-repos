<div align="center">
  <img src="./assets/logo-banner.svg" alt="Awesome GitHub Repository Showcase" width="400"/>
  
  # 🚀 Awesome GitHub Repository Showcase
  
  *A modern, elegant platform for showcasing your starred GitHub repositories*
  
  [![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
  [![Made with Love](https://img.shields.io/badge/Made%20with-❤️-red.svg)](https://github.com/tonngw)
  [![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
  [![CSS3](https://img.shields.io/badge/CSS3-Responsive-blue.svg)](https://developer.mozilla.org/en-US/docs/Web/CSS)
  
  [🌟 Live Demo](https://awesome.tonngw.com) | [📖 Documentation](#) | [🤝 Contributing](CONTRIBUTING.md)
  
  [English](#) | [中文](#)
</div>

---

### 📖 项目简介

**Awesome GitHub Repository Showcase** 是一个现代化的GitHub仓库展示平台，专为开发者设计，用于优雅地展示和管理收藏的开源项目。

🎯 **核心理念**: 让优秀的开源项目以最美观、最直观的方式呈现，帮助开发者更好地发现、整理和分享有价值的代码仓库。

💡 **设计灵感**: 参考了现代化的设计语言和用户体验最佳实践，打造出既美观又实用的展示平台。

![project](https://cdn.nlark.com/yuque/0/2025/png/1863084/1753015075615-429490c5-ec3d-46fd-b8fd-15413768e2fd.png?x-oss-process=image%2Fformat%2Cwebp)

<details>
  <summary>如果你喜欢简洁的页面风格可以使用 <code>index-simple.html</code></summary>
  <img src="https://ik.imagekit.io/tonngw/ZFvz7Wk-RUk56ZSCg14xCt6ZZtYvnHnGNo5HaRnA7YM.png" alt="截图" style="max-width:600px">
</details>

### ✨ 功能特性

- 🔍 **智能搜索**: 实时搜索仓库名称、描述、主题标签和作者，支持多关键词
- 🏷️ **语言过滤**: 按编程语言筛选仓库，提供快速过滤按钮和分类视图
- 📊 **多种排序**: 支持按星标数、名称、更新时间等多种方式排序
- 📱 **响应式设计**: 完美适配桌面、平板和移动设备
- ⚡ **性能优化**: 使用防抖搜索、虚拟滚动和懒加载优化性能
- ♿ **快捷支持**: 完整的键盘导航和快捷键支持
- 🎨 **精美动画**: 流畅的过渡动画和微交互效果

### 🛠️ 技术栈

| 类别 | 说明 |
| :--- | :--- |
| 前端 | 原生 HTML5 + CSS3 + JavaScript (ES6+) |
| 样式 | CSS Grid + Flexbox，CSS 自定义属性 |
| 字体 | Inter 字体家族 |
| 图标 | SVG 图标 |
| 部署 | GitHub Action + GitHub Pages |

### 🚀 快速开始

> 只需要简单几步配置，你就可以拥有一个属于自己的 Awesome GitHub Repository Showcase 平台，不需要写一行代码。

#### 1. **fork 项目**
项目地址：https://github.com/tonngw/awesome-github-repos
![Fork](https://ik.imagekit.io/tonngw/bdNMYe1Y_xYMD6RxAeQNQFycuvUa6lEZHamC-ZVaVfo.png)

#### 2. 环境配置

- 首先需要申请一个 GitHub API 秘钥，至少需要仓库读写权限（如果你不知道选择什么权限，建议多选择一些），申请地址：https://github.com/settings/tokens
![github api token](https://ik.imagekit.io/tonngw/CxY86LZAxwk5bVGRfcXazNfJ8b6a2Z8S4y02aK1bfgk.png)
至少需要仓库权限和 Workflow 工作流权限，把生成的秘钥保存好下面要用。
![permisson](https://ik.imagekit.io/tonngw/iW4gp7_h4bSKE4RrIJNz8PlPdScIGLGMAFgkYWflisE.png)

- 开启 GitHub Actions 工作流
![github actions](https://ik.imagekit.io/tonngw/KHrtz6OKqJR163jFX7WSWzhyPH5HOlBNtsQ0cGYQQsY.png)
可以看到两个工作流，一个是获取仓库数据，一个是部署到 GitHub Pages。update awesome list 工作流需要手动开启。
![workflow](https://ik.imagekit.io/tonngw/JRl7Iss4haO4b7MBBJR2x952j-Hhhn7UeHiwpt_CvgY.png)

- 配置仓库环境变量，操作路径 `Settins -> Secrets and varabiles -> Repository secrets`， 添加变量 `API_TOKEN` 把刚才我们申请的 GitHub API 秘钥填入。
![secrets](https://ik.imagekit.io/tonngw/__yp-4UTtYIWxQGM2fUNekzpmS9A_aW8_sVCQV1MojA.png)

#### 3. 开启 GitHub Pages 功能

- 开启 GitHub Pages 功能，操作路径 `Settings -> Pages -> Source -> GitHub Actions`，使用 GitHub Actions 部署。
![github pages](https://ik.imagekit.io/tonngw/tUpMc0CyiX5ZxDeiKhjciqjdMJUvZMrSRW3S3LI5Lio.png)
如果你有域名的话可以设置自己域名访问更加方便。

#### 4. 最后一步

点击 `Actions` 标签，找到 `update awesome list` 工作流，点击 `Run workflow` 按钮。假想敌等待自动执行完成。

![run](https://ik.imagekit.io/tonngw/okNu4mVvEDKRzqf2wFzr1iCqixfPFgD4jP5e_KHL2tc.png)

如果 `Deploy static content to Pages` 工作流执行顺利的话，会生成一个项目地址，点击就可以看到我们部署的页面了。
![page](https://ik.imagekit.io/tonngw/yflGqnAxtg79H2bzybyHokte4ZzctA7qAlIC7MVGFqo.png)

> 按照以上步骤操作完成之后，那么恭喜你已经成功部署完成了！

### 🔧 功能配置

#### 搜索功能
- 支持模糊搜索和多关键词搜索
- 搜索范围：仓库名称、描述、主题标签、作者
- 防抖延迟：200ms

#### 排序选项
- 🕒 最近收藏 (默认)
- ⭐ 星标数量 (高到低)
- ⭐ 星标数量 (低到高)
- 📝 名称 (A到Z)
- 📝 名称 (Z到A)
- 🕒 最近更新
- 🆕 最近创建

#### 语言分类
- 📊 热门语言 (按仓库数量排序)
- 🕒 最近语言 (按在data.json中的出现顺序)

#### 快捷键


  - `Ctrl/Cmd + K` - 快速聚焦搜索框
  - `Ctrl/Cmd + L` - 切换语言分类模式
  - `Ctrl/Cmd + R` - 清除所有过滤条件
  - `Escape` - 清空搜索内容
  - `Tab` / `Shift + Tab` - 在元素间切换焦点
  - `Arrow Keys` - 在仓库卡片间导航
  - `Enter` / `Space` - 激活当前焦点元素

### 📱 响应式设计

- **桌面**: ≥ 1200px (3列网格)
- **平板**: 769px - 1024px (2列网格)
- **手机**: ≤ 768px (1列网格)

### 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

### 🙏 致谢

- [mawesome](https://github.com/simonecorsi/mawesome) - 获取仓库数据的工作流