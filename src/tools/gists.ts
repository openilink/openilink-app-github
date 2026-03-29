/**
 * Gist Tools
 * 提供 GitHub Gist 的列出、创建、查看能力
 */
import type { Octokit } from "@octokit/rest";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** Gist 模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_gists",
    description: "列出当前用户的 Gist",
    command: "list_gists",
    parameters: {
      type: "object",
      properties: {
        count: { type: "number", description: "返回数量，默认 10" },
      },
    },
  },
  {
    name: "create_gist",
    description: "创建新的 Gist",
    command: "create_gist",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string", description: "Gist 描述（可选）" },
        filename: { type: "string", description: "文件名" },
        content: { type: "string", description: "文件内容" },
        public: { type: "boolean", description: "是否公开，默认 false" },
      },
      required: ["filename", "content"],
    },
  },
  {
    name: "get_gist",
    description: "获取 Gist 详情",
    command: "get_gist",
    parameters: {
      type: "object",
      properties: {
        gist_id: { type: "string", description: "Gist ID" },
      },
      required: ["gist_id"],
    },
  },
];

/** 创建 Gist 模块的 handler 映射 */
function createHandlers(octokit: Octokit): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出 Gist
  handlers.set("list_gists", async (ctx) => {
    const count = (ctx.args.count as number) ?? 10;

    try {
      const res = await octokit.rest.gists.list({
        per_page: count,
      });

      const gists = res.data;
      if (gists.length === 0) {
        return "暂无 Gist";
      }

      const lines = gists.map((g, i) => {
        const desc = g.description || "无描述";
        const fileCount = Object.keys(g.files ?? {}).length;
        const visibility = g.public ? "🌐公开" : "🔒私有";
        return `${i + 1}. ${desc} ${visibility}\n   文件数: ${fileCount} | 创建时间: ${g.created_at}`;
      });

      return `Gist 列表（共 ${gists.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出 Gist 失败: ${err.message ?? err}`;
    }
  });

  // 创建 Gist
  handlers.set("create_gist", async (ctx) => {
    const description: string = ctx.args.description ?? "";
    const filename: string = ctx.args.filename ?? "";
    const content: string = ctx.args.content ?? "";
    const isPublic = ctx.args.public ?? false;

    try {
      const res = await octokit.rest.gists.create({
        description: description || undefined,
        public: isPublic,
        files: {
          [filename]: { content },
        },
      });

      const g = res.data;
      return `Gist 创建成功!\nID: ${g.id}\n地址: ${g.html_url}\n可见性: ${g.public ? "公开" : "私有"}`;
    } catch (err: any) {
      return `创建 Gist 失败: ${err.message ?? err}`;
    }
  });

  // 获取 Gist 详情
  handlers.set("get_gist", async (ctx) => {
    const gistId: string = ctx.args.gist_id ?? "";

    try {
      const res = await octokit.rest.gists.get({
        gist_id: gistId,
      });

      const g = res.data;
      const visibility = g.public ? "🌐公开" : "🔒私有";

      const lines = [
        `Gist: ${g.description || "无描述"} ${visibility}`,
        `ID: ${g.id}`,
        `作者: ${g.owner?.login ?? "未知"}`,
        `创建时间: ${g.created_at}`,
        `更新时间: ${g.updated_at}`,
        `地址: ${g.html_url}`,
      ];

      // 展示每个文件的内容预览
      const files = g.files ?? {};
      for (const [name, file] of Object.entries(files)) {
        if (!file) continue;
        const preview = (file.content ?? "").length > 500
          ? (file.content ?? "").slice(0, 500) + "..."
          : file.content ?? "";
        lines.push(`\n📄 ${name} (${file.language ?? "未知语言"}):\n${preview}`);
      }

      return lines.join("\n");
    } catch (err: any) {
      return `获取 Gist 详情失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** Gist Tool 模块 */
export const gistsTools: ToolModule = { definitions, createHandlers };
