/**
 * tools/repos.ts 测试
 * Mock Octokit 验证仓库工具的 handler 和定义
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { reposTools } from "../../src/tools/repos.js";
import type { ToolContext } from "../../src/hub/types.js";

/** 创建模拟的 Octokit 实例 */
function createMockOctokit() {
  return {
    rest: {
      repos: {
        listForAuthenticatedUser: vi.fn().mockResolvedValue({
          data: [
            {
              full_name: "user/repo1",
              private: false,
              stargazers_count: 10,
              description: "第一个仓库",
            },
            {
              full_name: "user/repo2",
              private: true,
              stargazers_count: 5,
              description: null,
            },
          ],
        }),
        get: vi.fn().mockResolvedValue({
          data: {
            full_name: "user/repo1",
            private: false,
            description: "测试仓库",
            language: "TypeScript",
            stargazers_count: 10,
            forks_count: 3,
            open_issues_count: 2,
            default_branch: "main",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-06-01T00:00:00Z",
            html_url: "https://github.com/user/repo1",
          },
        }),
        createForAuthenticatedUser: vi.fn().mockResolvedValue({
          data: {
            full_name: "user/new-repo",
            private: false,
            html_url: "https://github.com/user/new-repo",
          },
        }),
      },
      search: {
        repos: vi.fn().mockResolvedValue({
          data: {
            total_count: 100,
            items: [
              {
                full_name: "org/search-result",
                private: false,
                stargazers_count: 500,
                description: "搜索到的仓库",
              },
            ],
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

describe("reposTools", () => {
  describe("tool definitions 结构", () => {
    it("应包含 4 个仓库相关工具定义", () => {
      const { definitions } = reposTools;
      expect(definitions).toHaveLength(4);

      const names = definitions.map((d) => d.name);
      expect(names).toContain("list_repos");
      expect(names).toContain("get_repo");
      expect(names).toContain("search_repos");
      expect(names).toContain("create_repo");
    });

    it("每个定义应包含 name, description, command 字段", () => {
      for (const def of reposTools.definitions) {
        expect(def.name).toBeTruthy();
        expect(def.description).toBeTruthy();
        expect(def.command).toBeTruthy();
      }
    });

    it("get_repo 应要求 owner 和 repo 为必填", () => {
      const getDef = reposTools.definitions.find((d) => d.name === "get_repo");
      expect(getDef?.parameters?.required).toContain("owner");
      expect(getDef?.parameters?.required).toContain("repo");
    });

    it("create_repo 应要求 name 为必填", () => {
      const createDef = reposTools.definitions.find((d) => d.name === "create_repo");
      expect(createDef?.parameters?.required).toContain("name");
    });
  });

  describe("createHandlers", () => {
    let octokit: ReturnType<typeof createMockOctokit>;
    let handlers: Map<string, any>;

    beforeEach(() => {
      octokit = createMockOctokit();
      handlers = reposTools.createHandlers(octokit);
    });

    it("应创建与 definitions 对应的 handler", () => {
      for (const def of reposTools.definitions) {
        expect(handlers.has(def.command)).toBe(true);
      }
    });

    describe("list_repos", () => {
      it("应返回格式化的仓库列表", async () => {
        const handler = handlers.get("list_repos")!;
        const result = await handler(makeCtx({}));

        expect(octokit.rest.repos.listForAuthenticatedUser).toHaveBeenCalledOnce();
        expect(result).toContain("仓库列表");
        expect(result).toContain("user/repo1");
        expect(result).toContain("user/repo2");
        expect(result).toContain("第一个仓库");
      });

      it("无仓库时应返回提示", async () => {
        octokit.rest.repos.listForAuthenticatedUser.mockResolvedValueOnce({
          data: [],
        });

        const handler = handlers.get("list_repos")!;
        const result = await handler(makeCtx({}));
        expect(result).toContain("暂无仓库");
      });

      it("应传递 type 和 count 参数", async () => {
        const handler = handlers.get("list_repos")!;
        await handler(makeCtx({ type: "all", count: 5 }));

        const callArgs = octokit.rest.repos.listForAuthenticatedUser.mock.calls[0][0];
        expect(callArgs.type).toBe("all");
        expect(callArgs.per_page).toBe(5);
      });
    });

    describe("get_repo", () => {
      it("应返回仓库详细信息", async () => {
        const handler = handlers.get("get_repo")!;
        const result = await handler(makeCtx({ owner: "user", repo: "repo1" }));

        expect(result).toContain("user/repo1");
        expect(result).toContain("TypeScript");
        expect(result).toContain("测试仓库");
        expect(result).toContain("main");
      });

      it("API 出错时应返回错误消息", async () => {
        octokit.rest.repos.get.mockRejectedValueOnce(new Error("Not Found"));

        const handler = handlers.get("get_repo")!;
        const result = await handler(makeCtx({ owner: "user", repo: "nonexistent" }));
        expect(result).toContain("获取仓库信息失败");
        expect(result).toContain("Not Found");
      });
    });

    describe("search_repos", () => {
      it("应返回搜索结果", async () => {
        const handler = handlers.get("search_repos")!;
        const result = await handler(makeCtx({ query: "test" }));

        expect(result).toContain("搜索结果");
        expect(result).toContain("org/search-result");
        expect(result).toContain("100");
      });

      it("无结果时应返回提示", async () => {
        octokit.rest.search.repos.mockResolvedValueOnce({
          data: { total_count: 0, items: [] },
        });

        const handler = handlers.get("search_repos")!;
        const result = await handler(makeCtx({ query: "nonexistent" }));
        expect(result).toContain("未找到");
      });
    });

    describe("create_repo", () => {
      it("应成功创建仓库", async () => {
        const handler = handlers.get("create_repo")!;
        const result = await handler(makeCtx({ name: "new-repo" }));

        expect(octokit.rest.repos.createForAuthenticatedUser).toHaveBeenCalledOnce();
        expect(result).toContain("创建成功");
        expect(result).toContain("user/new-repo");
      });
    });
  });
});
