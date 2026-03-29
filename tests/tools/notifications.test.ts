/**
 * tools/notifications.ts 测试
 * Mock Octokit 验证通知工具的 handler 和定义
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { notificationsTools } from "../../src/tools/notifications.js";
import type { ToolContext } from "../../src/hub/types.js";

/** 创建模拟的 Octokit 实例 */
function createMockOctokit() {
  return {
    rest: {
      activity: {
        listNotificationsForAuthenticatedUser: vi.fn().mockResolvedValue({
          data: [
            {
              unread: true,
              repository: { full_name: "user/repo1" },
              subject: { title: "Bug 修复", type: "Issue" },
              reason: "mention",
              updated_at: "2024-06-15T00:00:00Z",
            },
            {
              unread: false,
              repository: { full_name: "org/project" },
              subject: { title: "新功能 PR", type: "PullRequest" },
              reason: "review_requested",
              updated_at: "2024-06-14T00:00:00Z",
            },
          ],
        }),
        markNotificationsAsRead: vi.fn().mockResolvedValue({}),
      },
    },
  } as any;
}

/** 创建测试用 ToolContext */
function makeCtx(args: Record<string, any>): ToolContext {
  return {
    installationId: "inst-001",
    botId: "bot-456",
    userId: "user-001",
    traceId: "trace-001",
    args,
  };
}

describe("notificationsTools", () => {
  describe("tool definitions 结构", () => {
    it("应包含 2 个通知相关工具定义", () => {
      const { definitions } = notificationsTools;
      expect(definitions).toHaveLength(2);

      const names = definitions.map((d) => d.name);
      expect(names).toContain("list_notifications");
      expect(names).toContain("mark_notifications_read");
    });

    it("每个定义应包含 name, description, command 字段", () => {
      for (const def of notificationsTools.definitions) {
        expect(def.name).toBeTruthy();
        expect(def.description).toBeTruthy();
        expect(def.command).toBeTruthy();
      }
    });
  });

  describe("createHandlers", () => {
    let octokit: ReturnType<typeof createMockOctokit>;
    let handlers: Map<string, any>;

    beforeEach(() => {
      octokit = createMockOctokit();
      handlers = notificationsTools.createHandlers(octokit);
    });

    it("应创建与 definitions 对应的 handler", () => {
      for (const def of notificationsTools.definitions) {
        expect(handlers.has(def.command)).toBe(true);
      }
    });

    describe("list_notifications", () => {
      it("应返回格式化的通知列表", async () => {
        const handler = handlers.get("list_notifications")!;
        const result = await handler(makeCtx({}));

        expect(result).toContain("通知列表");
        expect(result).toContain("user/repo1");
        expect(result).toContain("Bug 修复");
        expect(result).toContain("org/project");
        expect(result).toContain("新功能 PR");
      });

      it("无通知时应返回提示（未读模式）", async () => {
        octokit.rest.activity.listNotificationsForAuthenticatedUser
          .mockResolvedValueOnce({ data: [] });

        const handler = handlers.get("list_notifications")!;
        const result = await handler(makeCtx({}));
        expect(result).toContain("暂无未读通知");
      });

      it("无通知时应返回提示（全部模式）", async () => {
        octokit.rest.activity.listNotificationsForAuthenticatedUser
          .mockResolvedValueOnce({ data: [] });

        const handler = handlers.get("list_notifications")!;
        const result = await handler(makeCtx({ all: true }));
        expect(result).toContain("暂无通知");
      });

      it("应传递 all 和 count 参数", async () => {
        const handler = handlers.get("list_notifications")!;
        await handler(makeCtx({ all: true, count: 5 }));

        const callArgs = octokit.rest.activity.listNotificationsForAuthenticatedUser.mock.calls[0][0];
        expect(callArgs.all).toBe(true);
        expect(callArgs.per_page).toBe(5);
      });
    });

    describe("mark_notifications_read", () => {
      it("应成功标记所有通知已读", async () => {
        const handler = handlers.get("mark_notifications_read")!;
        const result = await handler(makeCtx({}));

        expect(octokit.rest.activity.markNotificationsAsRead).toHaveBeenCalledOnce();
        expect(result).toContain("已标记为已读");
      });

      it("API 出错时应返回错误消息", async () => {
        octokit.rest.activity.markNotificationsAsRead
          .mockRejectedValueOnce(new Error("Unauthorized"));

        const handler = handlers.get("mark_notifications_read")!;
        const result = await handler(makeCtx({}));
        expect(result).toContain("标记通知已读失败");
        expect(result).toContain("Unauthorized");
      });
    });
  });
});
