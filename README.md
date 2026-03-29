# OpeniLink GitHub App

通过微信操作 GitHub -- 15 个 GitHub Tools，管理 Issue / PR / Repo / Actions。

## 功能概览

### 仓库管理 (4 Tools)
- `list_repos` - 列出仓库
- `get_repo` - 获取仓库信息
- `search_repos` - 搜索仓库
- `create_repo` - 创建仓库

### Issue 管理 (5 Tools)
- `list_issues` - 列出 Issue
- `create_issue` - 创建 Issue
- `get_issue` - 获取 Issue 详情
- `update_issue` - 更新 Issue
- `add_comment` - 添加评论

### PR 管理 (4 Tools)
- `list_pulls` - 列出 PR
- `get_pull` - 获取 PR 详情
- `create_pull` - 创建 PR
- `merge_pull` - 合并 PR

### Actions (2 Tools)
- `list_runs` - 列出工作流运行记录
- `get_run` - 获取运行详情

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
