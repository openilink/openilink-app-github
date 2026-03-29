/**
 * 仓库 Tools
 * 提供 GitHub 仓库的列出、查看、搜索、创建能力
 */
import type { Octokit } from "@octokit/rest";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** 仓库模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_repos",
    description: "列出当前用户的 GitHub 仓库",
    command: "list_repos",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: '仓库类型: "all"、"owner"、"member"，默认 "owner"',
        },
        count: {
          type: "number",
          description: "返回数量，默认 10",
        },
      },
    },
  },
  {
    name: "get_repo",
    description: "获取指定 GitHub 仓库的详细信息",
    command: "get_repo",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "search_repos",
    description: "搜索 GitHub 仓库",
    command: "search_repos",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词" },
        count: { type: "number", description: "返回数量，默认 10" },
      },
      required: ["query"],
    },
  },
  {
    name: "create_repo",
    description: "为当前用户创建新的 GitHub 仓库",
    command: "create_repo",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "仓库名称" },
        description: { type: "string", description: "仓库描述（可选）" },
        private: { type: "boolean", description: "是否私有仓库，默认 false" },
      },
      required: ["name"],
    },
  },
];

/** 创建仓库模块的 handler 映射 */
function createHandlers(octokit: Octokit): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出仓库
  handlers.set("list_repos", async (ctx) => {
    const repoType = (ctx.args.type as string) ?? "owner";
    const count = (ctx.args.count as number) ?? 10;

    try {
      const res = await octokit.rest.repos.listForAuthenticatedUser({
        type: repoType as "all" | "owner" | "member",
        per_page: count,
        sort: "updated",
      });

      const repos = res.data;
      if (repos.length === 0) {
        return "暂无仓库";
      }

      const lines = repos.map((r, i) => {
        const visibility = r.private ? "🔒私有" : "🌐公开";
        const stars = r.stargazers_count ?? 0;
        const desc = r.description ? `\n   ${r.description}` : "";
        return `${i + 1}. ${r.full_name} ${visibility} ⭐${stars}${desc}`;
      });

      return `仓库列表（共 ${repos.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出仓库失败: ${err.message ?? err}`;
    }
  });

  // 获取仓库详情
  handlers.set("get_repo", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";

    try {
      const res = await octokit.rest.repos.get({ owner, repo });
      const r = res.data;

      const visibility = r.private ? "🔒私有" : "🌐公开";
      const lines = [
        `仓库: ${r.full_name} ${visibility}`,
        `描述: ${r.description || "无"}`,
        `语言: ${r.language || "未知"}`,
        `Stars: ${r.stargazers_count} | Forks: ${r.forks_count} | Issues: ${r.open_issues_count}`,
        `默认分支: ${r.default_branch}`,
        `创建时间: ${r.created_at}`,
        `最后更新: ${r.updated_at}`,
        `地址: ${r.html_url}`,
      ];

      return lines.join("\n");
    } catch (err: any) {
      return `获取仓库信息失败: ${err.message ?? err}`;
    }
  });

  // 搜索仓库
  handlers.set("search_repos", async (ctx) => {
    const query: string = ctx.args.query ?? "";
    const count = (ctx.args.count as number) ?? 10;

    try {
      const res = await octokit.rest.search.repos({
        q: query,
        per_page: count,
      });

      const items = res.data.items;
      if (items.length === 0) {
        return `未找到与 "${query}" 相关的仓库`;
      }

      const lines = items.map((r, i) => {
        const visibility = r.private ? "🔒私有" : "🌐公开";
        const stars = r.stargazers_count ?? 0;
        const desc = r.description ? `\n   ${r.description}` : "";
        return `${i + 1}. ${r.full_name} ${visibility} ⭐${stars}${desc}`;
      });

      return `搜索结果（共 ${res.data.total_count} 个，显示前 ${items.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `搜索仓库失败: ${err.message ?? err}`;
    }
  });

  // 创建仓库
  handlers.set("create_repo", async (ctx) => {
    const name: string = ctx.args.name ?? "";
    const description: string = ctx.args.description ?? "";
    const isPrivate = ctx.args.private ?? false;

    try {
      const res = await octokit.rest.repos.createForAuthenticatedUser({
        name,
        description: description || undefined,
        private: isPrivate,
      });

      const r = res.data;
      return `仓库创建成功!\n名称: ${r.full_name}\n地址: ${r.html_url}\n可见性: ${r.private ? "私有" : "公开"}`;
    } catch (err: any) {
      return `创建仓库失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** 仓库 Tool 模块 */
export const reposTools: ToolModule = { definitions, createHandlers };
