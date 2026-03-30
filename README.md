# OpeniLink GitHub App

通过微信操作 GitHub -- 36 个 GitHub Tools，管理 Issue / PR / Repo / Actions / Release / Gist / 通知。

## 功能概览

### 仓库管理 (8 Tools)
- `list_repos` - 列出仓库
- `get_repo` - 获取仓库信息
- `search_repos` - 搜索仓库
- `create_repo` - 创建仓库
- `fork_repo` - Fork 仓库
- `star_repo` - Star 仓库
- `get_readme` - 获取 README
- `get_file_content` - 获取文件内容

### Issue 管理 (8 Tools)
- `list_issues` - 列出 Issue
- `create_issue` - 创建 Issue
- `get_issue` - 获取 Issue 详情
- `update_issue` - 更新 Issue
- `add_comment` - 添加评论
- `close_issue` - 关闭 Issue
- `assign_issue` - 分配 Issue
- `add_labels` - 添加标签

### PR 管理 (7 Tools)
- `list_pulls` - 列出 PR
- `get_pull` - 获取 PR 详情
- `create_pull` - 创建 PR
- `merge_pull` - 合并 PR
- `review_pull` - 审核 PR
- `list_pull_files` - 获取 PR 文件列表
- `close_pull` - 关闭 PR

### Actions (5 Tools)
- `list_runs` - 列出工作流运行记录
- `get_run` - 获取运行详情
- `trigger_workflow` - 触发工作流
- `cancel_run` - 取消运行
- `rerun_workflow` - 重新运行工作流

### Release (3 Tools)
- `list_releases` - 列出 Release
- `get_release` - 获取 Release 详情
- `create_release` - 创建 Release

### Gist (3 Tools)
- `list_gists` - 列出 Gist
- `create_gist` - 创建 Gist
- `get_gist` - 获取 Gist 详情

### 通知 (2 Tools)
- `list_notifications` - 列出通知
- `mark_notifications_read` - 标记全部已读

## 快速开始

```bash
# 安装依赖
npm install

# 设置环境变量
export HUB_URL=http://your-hub-url
export BASE_URL=http://your-app-url
export GITHUB_TOKEN=ghp_your_token

# 开发模式
npm run dev

# 构建并运行
npm run build
npm start
```

## Docker 部署

```bash
docker compose up -d
```

## 认证方式

使用 GitHub Personal Access Token (PAT) 认证，免费额度 5000 次/小时。

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `HUB_URL` | 是 | - | OpeniLink Hub 地址 |
| `BASE_URL` | 是 | - | 本 App 公网地址 |
| `GITHUB_TOKEN` | 是 | - | GitHub PAT |
| `PORT` | 否 | 8088 | HTTP 监听端口 |
| `DB_PATH` | 否 | data/github.db | SQLite 数据库路径 |

## 使用方式

安装到 Bot 后，支持三种方式调用：

### 自然语言（推荐）

直接用微信跟 Bot 对话，Hub AI 会自动识别意图并调用对应功能：

- "看看我的 GitHub 仓库有哪些 open 的 Issue"
- "帮我创建一个 Issue 标题是修复登录 bug"
- "合并 #42 号 PR"

### 命令调用

也可以使用 `/命令名 参数` 的格式直接调用：

- `/list_issues --owner xxx --repo yyy --state open`

### AI 自动调用

Hub AI 在多轮对话中会自动判断是否需要调用本 App 的功能，无需手动触发。

## 安全与隐私

### 数据处理说明

- **无状态工具**：本 App 为纯工具型应用，请求即响应，**不存储任何用户数据**
- **第三方 API 调用**：您的请求会通过 GitHub API 处理，请参阅其隐私政策
- **API Key 安全**：您的 API Key 仅存储在服务端环境变量或 Installation 配置中，不会暴露给其他用户

### 应用市场安装（托管模式）

通过 OpeniLink Hub 应用市场安装时，您的请求将通过我们的服务器转发至第三方 API。我们承诺：

- 不会记录、存储或分析您的请求内容和返回结果
- 您的 API Key 加密存储，仅用于调用对应的第三方服务
- 所有 App 代码完全开源，接受社区审查

### 自部署（推荐注重隐私的用户）

如果您对数据隐私有更高要求，建议自行部署：

```bash
docker compose up -d
```

自部署后 API Key 和所有请求数据仅在您自己的服务器上。

## License

MIT
