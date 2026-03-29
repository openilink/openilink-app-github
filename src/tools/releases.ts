/**
 * Release Tools
 * 提供 GitHub Release 的列出、查看、创建能力
 */
import type { Octokit } from "@octokit/rest";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** Release 模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_releases",
    description: "列出仓库的 Release",
    command: "list_releases",
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
    name: "get_release",
    description: "获取 Release 详情",
    command: "get_release",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        release_id: { type: "number", description: "Release ID" },
      },
      required: ["owner", "repo", "release_id"],
    },
  },
  {
    name: "create_release",
    description: "创建新的 Release",
    command: "create_release",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        tag_name: { type: "string", description: "标签名称" },
        name: { type: "string", description: "Release 名称（可选）" },
        body: { type: "string", description: "Release 描述（可选）" },
        draft: { type: "boolean", description: "是否为草稿，默认 false" },
        prerelease: { type: "boolean", description: "是否为预发布，默认 false" },
      },
      required: ["owner", "repo", "tag_name"],
    },
  },
];

/** 创建 Release 模块的 handler 映射 */
function createHandlers(octokit: Octokit): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出 Release
  handlers.set("list_releases", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const count = (ctx.args.count as number) ?? 10;

    try {
      const res = await octokit.rest.repos.listReleases({
        owner,
        repo,
        per_page: count,
      });

      const releases = res.data;
      if (releases.length === 0) {
        return `${owner}/${repo} 暂无 Release`;
      }

      const lines = releases.map((r, i) => {
        const draft = r.draft ? " 📝草稿" : "";
        const prerelease = r.prerelease ? " 🧪预发布" : "";
        return `${i + 1}. ${r.tag_name} ${r.name ?? ""}${draft}${prerelease}\n   作者: ${r.author?.login ?? "未知"} | 发布时间: ${r.published_at ?? "未发布"}`;
      });

      return `Release 列表（${owner}/${repo}）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出 Release 失败: ${err.message ?? err}`;
    }
  });

  // 获取 Release 详情
  handlers.set("get_release", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const releaseId: number = ctx.args.release_id ?? 0;

    try {
      const res = await octokit.rest.repos.getRelease({
        owner,
        repo,
        release_id: releaseId,
      });

      const r = res.data;
      const lines = [
        `Release: ${r.name ?? r.tag_name}`,
        `标签: ${r.tag_name}`,
        `状态: ${r.draft ? "草稿" : r.prerelease ? "预发布" : "正式版"}`,
        `作者: ${r.author?.login ?? "未知"}`,
        `发布时间: ${r.published_at ?? "未发布"}`,
        `创建时间: ${r.created_at}`,
        `地址: ${r.html_url}`,
      ];

      if (r.body) {
        const bodyPreview = r.body.length > 500
          ? r.body.slice(0, 500) + "..."
          : r.body;
        lines.push(`\n描述:\n${bodyPreview}`);
      }

      if (r.assets && r.assets.length > 0) {
        const assetLines = r.assets.map((a) => `  - ${a.name} (${a.download_count} 次下载)`);
        lines.push(`\n附件:\n${assetLines.join("\n")}`);
      }

      return lines.join("\n");
    } catch (err: any) {
      return `获取 Release 详情失败: ${err.message ?? err}`;
    }
  });

  // 创建 Release
  handlers.set("create_release", async (ctx) => {
    const owner: string = ctx.args.owner ?? "";
    const repo: string = ctx.args.repo ?? "";
    const tagName: string = ctx.args.tag_name ?? "";
    const name: string = ctx.args.name ?? "";
    const body: string = ctx.args.body ?? "";
    const draft = ctx.args.draft ?? false;
    const prerelease = ctx.args.prerelease ?? false;

    try {
      const res = await octokit.rest.repos.createRelease({
        owner,
        repo,
        tag_name: tagName,
        name: name || undefined,
        body: body || undefined,
        draft,
        prerelease,
      });

      const r = res.data;
      return `Release 创建成功!\n名称: ${r.name ?? r.tag_name}\n标签: ${r.tag_name}\n地址: ${r.html_url}`;
    } catch (err: any) {
      return `创建 Release 失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** Release Tool 模块 */
export const releasesTools: ToolModule = { definitions, createHandlers };
