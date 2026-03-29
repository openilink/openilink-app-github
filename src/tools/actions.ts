/**
 * Actions Tools
 * 提供 GitHub Actions Workflow Runs 的查看能力
 */
import type { Octokit } from "@octokit/rest";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** Actions 模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_runs",
    description: "列出仓库的 GitHub Actions 工作流运行记录",
    command: "list_runs",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        count: { type: "number", description: "返回数量，默认 10" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "get_run",
    description: "获取 GitHub Actions 工作流运行详情",
    command: "get_run",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        run_id: { type: "number", description: "运行 ID" },
      },
      required: ["owner", "repo", "run_id"],
    },
  },
];

/** 状态图标映射 */
function statusIcon(status: string | null, conclusion: string | null): string {
  if (status === "in_progress") return "🔄";
  if (status === "queued") return "⏳";
  if (conclusion === "success") return "✅";
  if (conclusion === "failure") return "❌";
  if (conclusion === "cancelled") return "⏹️";
  return "⚪";
}

/** 创建 Actions 模块的 handler 映射 */
function createHandlers(octokit: Octokit): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出工作流运行记录
  handlers.set("list_runs", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const count = (ctx.args.count as number) ?? 10;

    try {
      const res = await octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        per_page: count,
      });

      const runs = res.data.workflow_runs;
      if (runs.length === 0) {
        return `${owner}/${repo} 暂无工作流运行记录`;
      }

      const lines = runs.map((run, i) => {
        const icon = statusIcon(run.status, run.conclusion);
        const branch = run.head_branch ?? "未知分支";
        const event = run.event ?? "未知";
        return `${i + 1}. ${icon} #${run.run_number} ${run.name ?? "未命名"}\n   分支: ${branch} | 触发: ${event} | ${run.status}${run.conclusion ? `(${run.conclusion})` : ""}`;
      });

      return `工作流运行记录（${owner}/${repo}，共 ${res.data.total_count} 次）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出工作流运行失败: ${err.message ?? err}`;
    }
  });

  // 获取运行详情
  handlers.set("get_run", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const runId: number = ctx.args.run_id ?? 0;

    try {
      const res = await octokit.rest.actions.getWorkflowRun({
        owner,
        repo,
        run_id: runId,
      });

      const run = res.data;
      const icon = statusIcon(run.status, run.conclusion);

      const lines = [
        `${icon} 工作流运行 #${run.run_number}: ${run.name ?? "未命名"}`,
        `状态: ${run.status}${run.conclusion ? ` (${run.conclusion})` : ""}`,
        `分支: ${run.head_branch ?? "未知"}`,
        `触发事件: ${run.event}`,
        `触发者: ${run.actor?.login ?? "未知"}`,
        `Commit: ${run.head_sha?.slice(0, 7) ?? "未知"}`,
        `开始时间: ${run.run_started_at ?? run.created_at}`,
        `更新时间: ${run.updated_at}`,
        `地址: ${run.html_url}`,
      ];

      return lines.join("\n");
    } catch (err: any) {
      return `获取工作流运行详情失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** Actions Tool 模块 */
export const actionsTools: ToolModule = { definitions, createHandlers };
