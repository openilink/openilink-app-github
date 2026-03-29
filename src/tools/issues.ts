/**
 * Issue Tools
 * 提供 GitHub Issue 的列出、创建、查看、更新、评论能力
 */
import type { Octokit } from "@octokit/rest";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** Issue 模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_issues",
    description: "列出仓库的 Issue",
    command: "list_issues",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        state: {
          type: "string",
          description: 'Issue 状态: "open"、"closed"、"all"，默认 "open"',
        },
        count: { type: "number", description: "返回数量，默认 10" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "create_issue",
    description: "在仓库中创建新的 Issue",
    command: "create_issue",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        title: { type: "string", description: "Issue 标题" },
        body: { type: "string", description: "Issue 正文（可选）" },
        labels: {
          type: "string",
          description: "标签，逗号分隔（可选）",
        },
      },
      required: ["owner", "repo", "title"],
    },
  },
  {
    name: "get_issue",
    description: "获取 Issue 详情",
    command: "get_issue",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        issue_number: { type: "number", description: "Issue 编号" },
      },
      required: ["owner", "repo", "issue_number"],
    },
  },
  {
    name: "update_issue",
    description: "更新 Issue 的标题、正文或状态",
    command: "update_issue",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        issue_number: { type: "number", description: "Issue 编号" },
        title: { type: "string", description: "新标题（可选）" },
        body: { type: "string", description: "新正文（可选）" },
        state: {
          type: "string",
          description: '新状态: "open" 或 "closed"（可选）',
        },
      },
      required: ["owner", "repo", "issue_number"],
    },
  },
  {
    name: "add_comment",
    description: "为 Issue 添加评论",
    command: "add_comment",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        issue_number: { type: "number", description: "Issue 编号" },
        body: { type: "string", description: "评论内容" },
      },
      required: ["owner", "repo", "issue_number", "body"],
    },
  },
];

/** 创建 Issue 模块的 handler 映射 */
function createHandlers(octokit: Octokit): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出 Issue
  handlers.set("list_issues", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const state = (ctx.args.state as string) ?? "open";
    const count = (ctx.args.count as number) ?? 10;

    try {
      const res = await octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: state as "open" | "closed" | "all",
        per_page: count,
      });

      // 过滤掉 Pull Request（GitHub API 会把 PR 也作为 Issue 返回）
      const issues = res.data.filter((i) => !i.pull_request);
      if (issues.length === 0) {
        return `${owner}/${repo} 暂无 ${state} 状态的 Issue`;
      }

      const lines = issues.map((issue, i) => {
        const labels = issue.labels
          .map((l) => (typeof l === "string" ? l : l.name))
          .filter(Boolean)
          .join(", ");
        const labelStr = labels ? ` [${labels}]` : "";
        return `${i + 1}. #${issue.number} ${issue.title}${labelStr} (${issue.state})`;
      });

      return `Issue 列表（${owner}/${repo}，${state}）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出 Issue 失败: ${err.message ?? err}`;
    }
  });

  // 创建 Issue
  handlers.set("create_issue", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const title: string = ctx.args.title ?? "";
    const body: string = ctx.args.body ?? "";
    const labelsRaw: string = ctx.args.labels ?? "";

    try {
      const labels = labelsRaw
        ? labelsRaw.split(",").map((l: string) => l.trim()).filter(Boolean)
        : undefined;

      const res = await octokit.rest.issues.create({
        owner,
        repo,
        title,
        body: body || undefined,
        labels,
      });

      const issue = res.data;
      return `Issue 创建成功!\n编号: #${issue.number}\n标题: ${issue.title}\n地址: ${issue.html_url}`;
    } catch (err: any) {
      return `创建 Issue 失败: ${err.message ?? err}`;
    }
  });

  // 获取 Issue 详情
  handlers.set("get_issue", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const issueNumber: number = ctx.args.issue_number ?? 0;

    try {
      const res = await octokit.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });

      const issue = res.data;
      const labels = issue.labels
        .map((l) => (typeof l === "string" ? l : l.name))
        .filter(Boolean)
        .join(", ");
      const assignees = issue.assignees
        ?.map((a) => a.login)
        .join(", ") ?? "无";

      const lines = [
        `Issue #${issue.number}: ${issue.title}`,
        `状态: ${issue.state}`,
        `作者: ${issue.user?.login ?? "未知"}`,
        `标签: ${labels || "无"}`,
        `指派: ${assignees}`,
        `评论数: ${issue.comments}`,
        `创建时间: ${issue.created_at}`,
        `更新时间: ${issue.updated_at}`,
        `地址: ${issue.html_url}`,
      ];

      if (issue.body) {
        // 截取正文前 500 字符
        const bodyPreview = issue.body.length > 500
          ? issue.body.slice(0, 500) + "..."
          : issue.body;
        lines.push(`\n正文:\n${bodyPreview}`);
      }

      return lines.join("\n");
    } catch (err: any) {
      return `获取 Issue 详情失败: ${err.message ?? err}`;
    }
  });

  // 更新 Issue
  handlers.set("update_issue", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const issueNumber: number = ctx.args.issue_number ?? 0;

    try {
      const updateData: Record<string, any> = {};
      if (ctx.args.title) updateData.title = ctx.args.title;
      if (ctx.args.body) updateData.body = ctx.args.body;
      if (ctx.args.state) updateData.state = ctx.args.state;

      const res = await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        ...updateData,
      });

      const issue = res.data;
      return `Issue #${issue.number} 更新成功!\n标题: ${issue.title}\n状态: ${issue.state}`;
    } catch (err: any) {
      return `更新 Issue 失败: ${err.message ?? err}`;
    }
  });

  // 添加评论
  handlers.set("add_comment", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const issueNumber: number = ctx.args.issue_number ?? 0;
    const body: string = ctx.args.body ?? "";

    try {
      const res = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
      });

      return `评论添加成功!\nIssue #${issueNumber}\n评论 ID: ${res.data.id}\n地址: ${res.data.html_url}`;
    } catch (err: any) {
      return `添加评论失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** Issue Tool 模块 */
export const issuesTools: ToolModule = { definitions, createHandlers };
