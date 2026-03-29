/**
 * tools/gists.ts 测试
 * Mock Octokit 验证 Gist 工具的 handler 和定义
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { gistsTools } from "../../src/tools/gists.js";
import type { ToolContext } from "../../src/hub/types.js";

/** 创建模拟的 Octokit 实例 */
function createMockOctokit() {
  return {
    rest: {
      gists: {
        list: vi.fn().mockResolvedValue({
          data: [
            {
              id: "gist-001",
              description: "测试 Gist",
              public: true,
              files: { "test.js": {} },
              created_at: "2024-06-01T00:00:00Z",
            },
            {
              id: "gist-002",
              description: "",
              public: false,
              files: { "note.md": {}, "data.json": {} },
              created_at: "2024-05-01T00:00:00Z",
            },
          ],
        }),
        create: vi.fn().mockResolvedValue({
          data: {
            id: "gist-new",
            html_url: "https://gist.github.com/gist-new",
            public: false,
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: {
            id: "gist-001",
            description: "测试 Gist",
            public: true,
            owner: { login: "alice" },
            created_at: "2024-06-01T00:00:00Z",
            updated_at: "2024-06-15T00:00:00Z",
            html_url: "https://gist.github.com/gist-001",
            files: {
              "test.js": {
                language: "JavaScript",
                content: "console.log('hello');",
              },
            },
          },
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

describe("gistsTools", () => {
  describe("tool definitions 结构", () => {
    it("应包含 3 个 Gist 相关工具定义", () => {
      const { definitions } = gistsTools;
      expect(definitions).toHaveLength(3);

      const names = definitions.map((d) => d.name);
      expect(names).toContain("list_gists");
      expect(names).toContain("create_gist");
      expect(names).toContain("get_gist");
    });

    it("每个定义应包含 name, description, command 字段", () => {
      for (const def of gistsTools.definitions) {
        expect(def.name).toBeTruthy();
        expect(def.description).toBeTruthy();
        expect(def.command).toBeTruthy();
      }
    });

    it("create_gist 应要求 filename 和 content 为必填", () => {
      const createDef = gistsTools.definitions.find((d) => d.name === "create_gist");
      expect(createDef?.parameters?.required).toContain("filename");
      expect(createDef?.parameters?.required).toContain("content");
    });

    it("get_gist 应要求 gist_id 为必填", () => {
      const getDef = gistsTools.definitions.find((d) => d.name === "get_gist");
      expect(getDef?.parameters?.required).toContain("gist_id");
    });
  });

  describe("createHandlers", () => {
    let octokit: ReturnType<typeof createMockOctokit>;
    let handlers: Map<string, any>;

    beforeEach(() => {
      octokit = createMockOctokit();
      handlers = gistsTools.createHandlers(octokit);
    });

    it("应创建与 definitions 对应的 handler", () => {
      for (const def of gistsTools.definitions) {
        expect(handlers.has(def.command)).toBe(true);
      }
    });

    describe("list_gists", () => {
      it("应返回格式化的 Gist 列表", async () => {
        const handler = handlers.get("list_gists")!;
        const result = await handler(makeCtx({}));

        expect(result).toContain("Gist 列表");
        expect(result).toContain("测试 Gist");
        expect(result).toContain("无描述");
      });

      it("无 Gist 时应返回提示", async () => {
        octokit.rest.gists.list.mockResolvedValueOnce({ data: [] });

        const handler = handlers.get("list_gists")!;
        const result = await handler(makeCtx({}));
        expect(result).toContain("暂无 Gist");
      });

      it("应传递 count 参数", async () => {
        const handler = handlers.get("list_gists")!;
        await handler(makeCtx({ count: 5 }));

        const callArgs = octokit.rest.gists.list.mock.calls[0][0];
        expect(callArgs.per_page).toBe(5);
      });
    });

    describe("create_gist", () => {
      it("应成功创建 Gist", async () => {
        const handler = handlers.get("create_gist")!;
        const result = await handler(makeCtx({
          filename: "test.js",
          content: "console.log('hello');",
          description: "测试",
        }));

        expect(octokit.rest.gists.create).toHaveBeenCalledOnce();
        expect(result).toContain("创建成功");
        expect(result).toContain("gist-new");
      });

      it("API 出错时应返回错误消息", async () => {
        octokit.rest.gists.create.mockRejectedValueOnce(new Error("Unauthorized"));

        const handler = handlers.get("create_gist")!;
        const result = await handler(makeCtx({
          filename: "test.js",
          content: "hello",
        }));
        expect(result).toContain("创建 Gist 失败");
        expect(result).toContain("Unauthorized");
      });
    });

    describe("get_gist", () => {
      it("应返回 Gist 详细信息", async () => {
        const handler = handlers.get("get_gist")!;
        const result = await handler(makeCtx({ gist_id: "gist-001" }));

        expect(result).toContain("gist-001");
        expect(result).toContain("测试 Gist");
        expect(result).toContain("alice");
        expect(result).toContain("test.js");
        expect(result).toContain("JavaScript");
        expect(result).toContain("console.log");
      });

      it("API 出错时应返回错误消息", async () => {
        octokit.rest.gists.get.mockRejectedValueOnce(new Error("Not Found"));

        const handler = handlers.get("get_gist")!;
        const result = await handler(makeCtx({ gist_id: "nonexistent" }));
        expect(result).toContain("获取 Gist 详情失败");
        expect(result).toContain("Not Found");
      });
    });
  });
});
