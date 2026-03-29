/**
 * Pull Request Tools
 * 提供 GitHub PR 的列出、查看、创建、合并能力
 */
import type { Octokit } from "@octokit/rest";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** PR 模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_pulls",
    description: "列出仓库的 Pull Request",
    command: "list_pulls",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        state: {
          type: "string",
          description: 'PR 状态: "open"、"closed"、"all"，默认 "open"',
        },
        count: { type: "number", description: "返回数量，默认 10" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "get_pull",
    description: "获取 Pull Request 详情",
    command: "get_pull",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        pull_number: { type: "number", description: "PR 编号" },
      },
      required: ["owner", "repo", "pull_number"],
    },
  },
  {
    name: "create_pull",
    description: "创建 Pull Request",
    command: "create_pull",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        title: { type: "string", description: "PR 标题" },
        head: { type: "string", description: "源分支" },
        base: { type: "string", description: "目标分支" },
        body: { type: "string", description: "PR 描述（可选）" },
      },
      required: ["owner", "repo", "title", "head", "base"],
    },
  },
  {
    name: "merge_pull",
    description: "合并 Pull Request",
    command: "merge_pull",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        pull_number: { type: "number", description: "PR 编号" },
        merge_method: {
          type: "string",
          description: '合并方式: "merge"、"squash"、"rebase"，默认 "merge"',
        },
      },
      required: ["owner", "repo", "pull_number"],
    },
  },
  {
    name: "review_pull",
    description: "审核 Pull Request",
    command: "review_pull",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        pull_number: { type: "number", description: "PR 编号" },
        event: {
          type: "string",
          description: '审核动作: "APPROVE"、"COMMENT"、"REQUEST_CHANGES"',
        },
        body: { type: "string", description: "审核评论（可选）" },
      },
      required: ["owner", "repo", "pull_number", "event"],
    },
  },
  {
    name: "list_pull_files",
    description: "获取 Pull Request 的文件变更列表",
    command: "list_pull_files",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        pull_number: { type: "number", description: "PR 编号" },
      },
      required: ["owner", "repo", "pull_number"],
    },
  },
  {
    name: "close_pull",
    description: "关闭 Pull Request",
    command: "close_pull",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        pull_number: { type: "number", description: "PR 编号" },
      },
      required: ["owner", "repo", "pull_number"],
    },
  },
];

/** 创建 PR 模块的 handler 映射 */
function createHandlers(octokit: Octokit): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出 PR
  handlers.set("list_pulls", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const state = (ctx.args.state as string) ?? "open";
    const count = (ctx.args.count as number) ?? 10;

    try {
      const res = await octokit.rest.pulls.list({
        owner,
        repo,
        state: state as "open" | "closed" | "all",
        per_page: count,
      });

      const pulls = res.data;
      if (pulls.length === 0) {
        return `${owner}/${repo} 暂无 ${state} 状态的 PR`;
      }

      const lines = pulls.map((pr, i) => {
        const merged = pr.merged_at ? " ✅已合并" : "";
        const draft = pr.draft ? " 📝草稿" : "";
        return `${i + 1}. #${pr.number} ${pr.title} (${pr.state}${merged}${draft})\n   ${pr.head.label} → ${pr.base.label}`;
      });

      return `PR 列表（${owner}/${repo}，${state}）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出 PR 失败: ${err.message ?? err}`;
    }
  });

  // 获取 PR 详情
  handlers.set("get_pull", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const pullNumber: number = ctx.args.pull_number ?? 0;

    try {
      const res = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
      });

      const pr = res.data;
      const reviewers = pr.requested_reviewers
        ?.map((r) => r.login)
        .join(", ") ?? "无";
      const merged = pr.merged ? "✅ 已合并" : pr.state === "closed" ? "❌ 已关闭" : "🟢 开放中";

      const lines = [
        `PR #${pr.number}: ${pr.title}`,
        `状态: ${merged}`,
        `作者: ${pr.user?.login ?? "未知"}`,
        `分支: ${pr.head.label} → ${pr.base.label}`,
        `审核人: ${reviewers}`,
        `变更: +${pr.additions} -${pr.deletions}（${pr.changed_files} 个文件）`,
        `评论数: ${pr.comments} | 审核评论: ${pr.review_comments}`,
        `可合并: ${pr.mergeable === null ? "检查中" : pr.mergeable ? "是" : "否"}`,
        `创建时间: ${pr.created_at}`,
        `更新时间: ${pr.updated_at}`,
        `地址: ${pr.html_url}`,
      ];

      if (pr.body) {
        const bodyPreview = pr.body.length > 500
          ? pr.body.slice(0, 500) + "..."
          : pr.body;
        lines.push(`\n描述:\n${bodyPreview}`);
      }

      return lines.join("\n");
    } catch (err: any) {
      return `获取 PR 详情失败: ${err.message ?? err}`;
    }
  });

  // 创建 PR
  handlers.set("create_pull", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const title: string = ctx.args.title ?? "";
    const head: string = ctx.args.head ?? "";
    const base: string = ctx.args.base ?? "";
    const body: string = ctx.args.body ?? "";

    try {
      const res = await octokit.rest.pulls.create({
        owner,
        repo,
        title,
        head,
        base,
        body: body || undefined,
      });

      const pr = res.data;
      return `PR 创建成功!\n编号: #${pr.number}\n标题: ${pr.title}\n分支: ${pr.head.label} → ${pr.base.label}\n地址: ${pr.html_url}`;
    } catch (err: any) {
      return `创建 PR 失败: ${err.message ?? err}`;
    }
  });

  // 合并 PR
  handlers.set("merge_pull", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const pullNumber: number = ctx.args.pull_number ?? 0;
    const mergeMethod = (ctx.args.merge_method as string) ?? "merge";

    try {
      const res = await octokit.rest.pulls.merge({
        owner,
        repo,
        pull_number: pullNumber,
        merge_method: mergeMethod as "merge" | "squash" | "rebase",
      });

      if (res.data.merged) {
        return `PR #${pullNumber} 合并成功!\nSHA: ${res.data.sha}\n方式: ${mergeMethod}`;
      } else {
        return `PR #${pullNumber} 合并失败: ${res.data.message}`;
      }
    } catch (err: any) {
      return `合并 PR 失败: ${err.message ?? err}`;
    }
  });

  // 审核 PR
  handlers.set("review_pull", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const pullNumber: number = ctx.args.pull_number ?? 0;
    const event = (ctx.args.event as string) ?? "COMMENT";
    const body: string = ctx.args.body ?? "";

    try {
      const res = await octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        event: event as "APPROVE" | "COMMENT" | "REQUEST_CHANGES",
        body: body || undefined,
      });

      const review = res.data;
      return `PR #${pullNumber} 审核提交成功!\n审核 ID: ${review.id}\n动作: ${event}\n状态: ${review.state}`;
    } catch (err: any) {
      return `审核 PR 失败: ${err.message ?? err}`;
    }
  });

  // 获取 PR 文件列表
  handlers.set("list_pull_files", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const pullNumber: number = ctx.args.pull_number ?? 0;

    try {
      const res = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber,
      });

      const files = res.data;
      if (files.length === 0) {
        return `PR #${pullNumber} 暂无文件变更`;
      }

      const lines = files.map((f, i) => {
        return `${i + 1}. ${f.status} ${f.filename} (+${f.additions} -${f.deletions})`;
      });

      return `PR #${pullNumber} 文件变更（共 ${files.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `获取 PR 文件列表失败: ${err.message ?? err}`;
    }
  });

  // 关闭 PR
  handlers.set("close_pull", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const pullNumber: number = ctx.args.pull_number ?? 0;

    try {
      const res = await octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: pullNumber,
        state: "closed",
      });

      const pr = res.data;
      return `PR #${pr.number} 已关闭!\n标题: ${pr.title}`;
    } catch (err: any) {
      return `关闭 PR 失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** PR Tool 模块 */
export const pullsTools: ToolModule = { definitions, createHandlers };
