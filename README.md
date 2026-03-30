# @openilink/app-github

[![OpeniLink Hub](https://img.shields.io/badge/OpeniLink_Hub-安装到微信-07C160?style=for-the-badge&logo=wechat&logoColor=white)](https://github.com/openilink/openilink-hub)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)]()

> 在微信里管理 GitHub -- Issue、PR、Repo、Actions、Release、Gist、通知，一句话搞定。

**36 个 AI Tools** | PAT 认证 5000 次/小时 | 纯工具型无状态应用

---

## 亮点

- **36 个工具覆盖 GitHub 日常** -- 从创建 Issue 到合并 PR、触发 Actions，几乎不用打开浏览器
- **自然语言驱动** -- 对 Bot 说「帮我创建一个 Issue 标题是修复登录 bug」即可
- **无状态零存储** -- 请求即响应，不存储任何用户数据
- **PAT 认证** -- GitHub Personal Access Token，免费 5000 次/小时

## 36 个 AI Tools 一览

| 分类 | 数量 | 工具 |
|------|------|------|
| **仓库管理** | 8 | `list_repos` `get_repo` `search_repos` `create_repo` `fork_repo` `star_repo` `get_readme` `get_file_content` |
| **Issue 管理** | 8 | `list_issues` `create_issue` `get_issue` `update_issue` `add_comment` `close_issue` `assign_issue` `add_labels` |
| **PR 管理** | 7 | `list_pulls` `get_pull` `create_pull` `merge_pull` `review_pull` `list_pull_files` `close_pull` |
| **Actions** | 5 | `list_runs` `get_run` `trigger_workflow` `cancel_run` `rerun_workflow` |
| **Release** | 3 | `list_releases` `get_release` `create_release` |
| **Gist** | 3 | `list_gists` `create_gist` `get_gist` |
| **通知** | 2 | `list_notifications` `mark_notifications_read` |

## 使用方式

安装到 Bot 后，支持三种方式：

**自然语言（推荐）** -- 直接对 Bot 说话，Hub AI 自动识别意图并调用：
- "看看我的 GitHub 仓库有哪些 open 的 Issue"
- "帮我创建一个 Issue 标题是修复登录 bug"
- "合并 #42 号 PR"

**命令调用** -- `/list_issues --owner xxx --repo yyy --state open`

**AI 自动调用** -- Hub AI 在多轮对话中自动判断何时需要调用本 App。

<details>
<summary><strong>部署与配置</strong></summary>

### 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `HUB_URL` | 是 | -- | OpeniLink Hub 地址 |
| `BASE_URL` | 是 | -- | 本 App 公网地址 |
| `GITHUB_TOKEN` | 是 | -- | GitHub Personal Access Token |
| `PORT` | 否 | `8088` | HTTP 监听端口 |
| `DB_PATH` | 否 | `data/github.db` | SQLite 数据库路径 |

### 启动

```bash
# Docker（推荐）
docker compose up -d

# 或源码运行
git clone https://github.com/openilink/openilink-app-github.git
cd openilink-app-github
npm install
npm run build && npm start
```

### 认证方式

使用 GitHub Personal Access Token (PAT) 认证。前往 [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens) 创建，免费额度 5000 次/小时。

</details>

## 安全与隐私

- **无状态工具** -- 请求即响应，不存储任何用户数据
- **API Key 安全** -- 仅存储在服务端环境变量或 Installation 配置中，不会暴露给其他用户
- **完全开源** -- 所有代码接受社区审查；自部署后数据完全不经过第三方

## 更多 OpeniLink Hub App

| App | 说明 |
|-----|------|
| [openilink-hub](https://github.com/openilink/openilink-hub) | 开源微信 Bot 管理平台 |
| [app-notion](https://github.com/openilink/openilink-app-notion) | 微信操作 Notion -- 15 Tools |
| [app-linear](https://github.com/openilink/openilink-app-linear) | 微信管理 Linear -- 13 Tools |
| [app-amap](https://github.com/openilink/openilink-app-amap) | 微信查高德地图 -- 10 Tools |
| [app-lark](https://github.com/openilink/openilink-app-lark) | 微信 <-> 飞书桥接 -- 34 Tools |
| [app-slack](https://github.com/openilink/openilink-app-slack) | 微信 <-> Slack 桥接 -- 23 Tools |
| [app-dingtalk](https://github.com/openilink/openilink-app-dingtalk) | 微信 <-> 钉钉桥接 -- 20 Tools |
| [app-discord](https://github.com/openilink/openilink-app-discord) | 微信 <-> Discord 桥接 -- 19 Tools |
| [app-google](https://github.com/openilink/openilink-app-google) | 微信操作 Google Workspace -- 18 Tools |

## License

MIT
