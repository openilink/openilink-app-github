/**
 * Notification Tools
 * 提供 GitHub 通知的列出、标记已读能力
 */
import type { Octokit } from "@octokit/rest";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** 通知模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_notifications",
    description: "列出 GitHub 通知",
    command: "list_notifications",
    parameters: {
      type: "object",
      properties: {
        all: {
          type: "boolean",
          description: "是否显示全部通知（默认 false，仅显示未读）",
        },
        count: { type: "number", description: "返回数量，默认 10" },
      },
    },
  },
  {
    name: "mark_notifications_read",
    description: "标记所有通知为已读",
    command: "mark_notifications_read",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];

/** 创建通知模块的 handler 映射 */
function createHandlers(octokit: Octokit): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出通知
  handlers.set("list_notifications", async (ctx) => {
    const all = ctx.args.all ?? false;
    const count = (ctx.args.count as number) ?? 10;

    try {
      const res = await octokit.rest.activity.listNotificationsForAuthenticatedUser({
        all,
        per_page: count,
      });

      const notifications = res.data;
      if (notifications.length === 0) {
        return all ? "暂无通知" : "暂无未读通知";
      }

      const lines = notifications.map((n, i) => {
        const unread = n.unread ? "🔴" : "⚪";
        const repo = n.repository?.full_name ?? "未知仓库";
        const reason = n.reason ?? "未知";
        return `${i + 1}. ${unread} [${repo}] ${n.subject?.title ?? "无标题"}\n   类型: ${n.subject?.type ?? "未知"} | 原因: ${reason} | 更新时间: ${n.updated_at}`;
      });

      const label = all ? "全部" : "未读";
      return `${label}通知列表（共 ${notifications.length} 条）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出通知失败: ${err.message ?? err}`;
    }
  });

  // 标记全部已读
  handlers.set("mark_notifications_read", async (_ctx) => {
    try {
      await octokit.rest.activity.markNotificationsAsRead();

      return "所有通知已标记为已读!";
    } catch (err: any) {
      return `标记通知已读失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** 通知 Tool 模块 */
export const notificationsTools: ToolModule = { definitions, createHandlers };
