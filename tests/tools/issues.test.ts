/**
 * tools/issues.ts 测试
 * Mock Octokit 验证 Issue 工具的 handler 和定义
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { issuesTools } from "../../src/tools/issues.js";
import type { ToolContext } from "../../src/hub/types.js";

/** 创建模拟的 Octokit 实例 */
function createMockOctokit() {
  return {
    rest: {
      issues: {
        listForRepo: vi.fn().mockResolvedValue({
          data: [
            {
              number: 1,
              title: "Bug: 页面加载失败",
              state: "open",
              labels: [{ name: "bug" }],
              pull_request: undefined,
            },
            {
              number: 2,
              title: "Feature: 新增搜索",
              state: "open",
              labels: [{ name: "enhancement" }],
              pull_request: undefined,
            },
            {
              number: 3,
              title: "PR: 修复 bug",
              state: "open",
              labels: [],
              pull_request: { url: "https://api.github.com/..." },
            },
          ],
        }),
        create: vi.fn().mockResolvedValue({
          data: {
            number: 10,
            title: "新建的 Issue",
            html_url: "https://github.com/user/repo/issues/10",
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: {
            number: 1,
            title: "Bug: 页面加载失败",
            state: "open",
            user: { login: "alice" },
            labels: [{ name: "bug" }],
            assignees: [{ login: "bob" }],
            comments: 3,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-06-01T00:00:00Z",
            html_url: "https://github.com/user/repo/issues/1",
            body: "页面在特定条件下加载失败",
          },
        }),
        update: vi.fn().mockResolvedValue({
          data: {
            number: 1,
            title: "Bug: 已修复",
            state: "closed",
          },
        }),
        createComment: vi.fn().mockResolvedValue({
          data: {
            id: 12345,
            html_url: "https://github.com/user/repo/issues/1#issuecomment-12345",
          },
        }),
        addAssignees: vi.fn().mockResolvedValue({
          data: {
            number: 1,
            assignees: [{ login: "bob" }, { login: "charlie" }],
          },
        }),
        addLabels: vi.fn().mockResolvedValue({
          data: [
            { name: "bug" },
            { name: "enhancement" },
          ],
        }),
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

describe("issuesTools", () => {
  describe("tool definitions 结构", () => {
    it("应包含 8 个 Issue 相关工具定义", () => {
      const { definitions } = issuesTools;
      expect(definitions).toHaveLength(8);

      const names = definitions.map((d) => d.name);
      expect(names).toContain("list_issues");
      expect(names).toContain("create_issue");
      expect(names).toContain("get_issue");
      expect(names).toContain("update_issue");
      expect(names).toContain("add_comment");
      expect(names).toContain("close_issue");
      expect(names).toContain("assign_issue");
      expect(names).toContain("add_labels");
    });

    it("create_issue 应要求 owner, repo, title 为必填", () => {
      const createDef = issuesTools.definitions.find((d) => d.name === "create_issue");
      expect(createDef?.parameters?.required).toContain("owner");
      expect(createDef?.parameters?.required).toContain("repo");
      expect(createDef?.parameters?.required).toContain("title");
    });

    it("add_comment 应要求 body 为必填", () => {
      const commentDef = issuesTools.definitions.find((d) => d.name === "add_comment");
      expect(commentDef?.parameters?.required).toContain("body");
    });
  });

  describe("createHandlers", () => {
    let octokit: ReturnType<typeof createMockOctokit>;
    let handlers: Map<string, any>;

    beforeEach(() => {
      octokit = createMockOctokit();
      handlers = issuesTools.createHandlers(octokit);
    });

    it("应创建与 definitions 对应的 handler", () => {
      for (const def of issuesTools.definitions) {
        expect(handlers.has(def.command)).toBe(true);
      }
    });

    describe("list_issues", () => {
      it("应返回格式化的 Issue 列表，排除 PR", async () => {
        const handler = handlers.get("list_issues")!;
        const result = await handler(makeCtx({ owner: "user", repo: "repo" }));

        expect(result).toContain("Issue 列表");
        expect(result).toContain("#1");
        expect(result).toContain("Bug: 页面加载失败");
        expect(result).toContain("#2");
        // PR (#3) 应被过滤掉
        expect(result).not.toContain("#3");
      });

      it("无 Issue 时应返回提示", async () => {
        octokit.rest.issues.listForRepo.mockResolvedValueOnce({ data: [] });

        const handler = handlers.get("list_issues")!;
        const result = await handler(makeCtx({ owner: "user", repo: "repo" }));
        expect(result).toContain("暂无");
      });
    });

    describe("create_issue", () => {
      it("应成功创建 Issue", async () => {
        const handler = handlers.get("create_issue")!;
        const result = await handler(makeCtx({
          owner: "user",
          repo: "repo",
          title: "新 Issue",
          body: "描述",
        }));

        expect(octokit.rest.issues.create).toHaveBeenCalledOnce();
        expect(result).toContain("创建成功");
        expect(result).toContain("#10");
      });

      it("应正确处理 labels 参数（逗号分隔）", async () => {
        const handler = handlers.get("create_issue")!;
        await handler(makeCtx({
          owner: "user",
          repo: "repo",
          title: "带标签",
          labels: "bug, enhancement",
        }));

        const callArgs = octokit.rest.issues.create.mock.calls[0][0];
        expect(callArgs.labels).toEqual(["bug", "enhancement"]);
      });
    });

    describe("get_issue", () => {
      it("应返回 Issue 详细信息", async () => {
        const handler = handlers.get("get_issue")!;
        const result = await handler(makeCtx({
          owner: "user",
          repo: "repo",
          issue_number: 1,
        }));

        expect(result).toContain("#1");
        expect(result).toContain("Bug: 页面加载失败");
        expect(result).toContain("alice");
        expect(result).toContain("bug");
        expect(result).toContain("bob");
      });
    });

    describe("update_issue", () => {
      it("应成功更新 Issue", async () => {
        const handler = handlers.get("update_issue")!;
        const result = await handler(makeCtx({
          owner: "user",
          repo: "repo",
          issue_number: 1,
          state: "closed",
        }));

        expect(octokit.rest.issues.update).toHaveBeenCalledOnce();
        expect(result).toContain("更新成功");
      });
    });

    describe("add_comment", () => {
      it("应成功添加评论", async () => {
        const handler = handlers.get("add_comment")!;
        const result = await handler(makeCtx({
          owner: "user",
          repo: "repo",
          issue_number: 1,
          body: "这是一条评论",
        }));

        expect(octokit.rest.issues.createComment).toHaveBeenCalledOnce();
        expect(result).toContain("评论添加成功");
        expect(result).toContain("12345");
      });
    });

    describe("close_issue", () => {
      it("应成功关闭 Issue", async () => {
        const handler = handlers.get("close_issue")!;
        const result = await handler(makeCtx({
          owner: "user",
          repo: "repo",
          issue_number: 1,
        }));

        expect(octokit.rest.issues.update).toHaveBeenCalled();
        const callArgs = octokit.rest.issues.update.mock.calls[0][0];
        expect(callArgs.state).toBe("closed");
        expect(result).toContain("已关闭");
      });

      it("API 出错时应返回错误消息", async () => {
        octokit.rest.issues.update.mockRejectedValueOnce(new Error("Not Found"));

        const handler = handlers.get("close_issue")!;
        const result = await handler(makeCtx({
          owner: "user",
          repo: "repo",
          issue_number: 999,
        }));
        expect(result).toContain("关闭 Issue 失败");
      });
    });

    describe("assign_issue", () => {
      it("应成功分配 Issue", async () => {
        const handler = handlers.get("assign_issue")!;
        const result = await handler(makeCtx({
          owner: "user",
          repo: "repo",
          issue_number: 1,
          assignees: "bob, charlie",
        }));

        expect(octokit.rest.issues.addAssignees).toHaveBeenCalledOnce();
        const callArgs = octokit.rest.issues.addAssignees.mock.calls[0][0];
        expect(callArgs.assignees).toEqual(["bob", "charlie"]);
        expect(result).toContain("指派成功");
        expect(result).toContain("bob");
        expect(result).toContain("charlie");
      });
    });

    describe("add_labels", () => {
      it("应成功添加标签", async () => {
        const handler = handlers.get("add_labels")!;
        const result = await handler(makeCtx({
          owner: "user",
          repo: "repo",
          issue_number: 1,
          labels: "bug, enhancement",
        }));

        expect(octokit.rest.issues.addLabels).toHaveBeenCalledOnce();
        const callArgs = octokit.rest.issues.addLabels.mock.calls[0][0];
        expect(callArgs.labels).toEqual(["bug", "enhancement"]);
        expect(result).toContain("标签添加成功");
        expect(result).toContain("bug");
        expect(result).toContain("enhancement");
      });
    });
  });
});
