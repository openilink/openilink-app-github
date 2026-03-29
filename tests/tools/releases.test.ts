/**
 * tools/releases.ts 测试
 * Mock Octokit 验证 Release 工具的 handler 和定义
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { releasesTools } from "../../src/tools/releases.js";
import type { ToolContext } from "../../src/hub/types.js";

/** 创建模拟的 Octokit 实例 */
function createMockOctokit() {
  return {
    rest: {
      repos: {
        listReleases: vi.fn().mockResolvedValue({
          data: [
            {
              tag_name: "v1.0.0",
              name: "正式版 1.0",
              draft: false,
              prerelease: false,
              author: { login: "alice" },
              published_at: "2024-06-01T00:00:00Z",
            },
            {
              tag_name: "v0.9.0-beta",
              name: "测试版",
              draft: false,
              prerelease: true,
              author: { login: "bob" },
              published_at: "2024-05-01T00:00:00Z",
            },
          ],
        }),
        getRelease: vi.fn().mockResolvedValue({
          data: {
            tag_name: "v1.0.0",
            name: "正式版 1.0",
            draft: false,
            prerelease: false,
            author: { login: "alice" },
            published_at: "2024-06-01T00:00:00Z",
            created_at: "2024-05-30T00:00:00Z",
            html_url: "https://github.com/user/repo/releases/tag/v1.0.0",
            body: "这是 1.0 正式版的发布说明",
            assets: [
              { name: "app.zip", download_count: 100 },
            ],
          },
        }),
        createRelease: vi.fn().mockResolvedValue({
          data: {
            tag_name: "v2.0.0",
            name: "正式版 2.0",
            html_url: "https://github.com/user/repo/releases/tag/v2.0.0",
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

describe("releasesTools", () => {
  describe("tool definitions 结构", () => {
    it("应包含 3 个 Release 相关工具定义", () => {
      const { definitions } = releasesTools;
      expect(definitions).toHaveLength(3);

      const names = definitions.map((d) => d.name);
      expect(names).toContain("list_releases");
      expect(names).toContain("get_release");
      expect(names).toContain("create_release");
    });

    it("每个定义应包含 name, description, command 字段", () => {
      for (const def of releasesTools.definitions) {
        expect(def.name).toBeTruthy();
        expect(def.description).toBeTruthy();
        expect(def.command).toBeTruthy();
      }
    });

    it("create_release 应要求 owner, repo, tag_name 为必填", () => {
      const createDef = releasesTools.definitions.find((d) => d.name === "create_release");
      expect(createDef?.parameters?.required).toContain("owner");
      expect(createDef?.parameters?.required).toContain("repo");
      expect(createDef?.parameters?.required).toContain("tag_name");
    });
  });

  describe("createHandlers", () => {
    let octokit: ReturnType<typeof createMockOctokit>;
    let handlers: Map<string, any>;

    beforeEach(() => {
      octokit = createMockOctokit();
      handlers = releasesTools.createHandlers(octokit);
    });

    it("应创建与 definitions 对应的 handler", () => {
      for (const def of releasesTools.definitions) {
        expect(handlers.has(def.command)).toBe(true);
      }
    });

    describe("list_releases", () => {
      it("应返回格式化的 Release 列表", async () => {
        const handler = handlers.get("list_releases")!;
        const result = await handler(makeCtx({ owner: "user", repo: "repo" }));

        expect(result).toContain("Release 列表");
        expect(result).toContain("v1.0.0");
        expect(result).toContain("v0.9.0-beta");
        expect(result).toContain("预发布");
      });

      it("无 Release 时应返回提示", async () => {
        octokit.rest.repos.listReleases.mockResolvedValueOnce({ data: [] });

        const handler = handlers.get("list_releases")!;
        const result = await handler(makeCtx({ owner: "user", repo: "repo" }));
        expect(result).toContain("暂无 Release");
      });
    });

    describe("get_release", () => {
      it("应返回 Release 详细信息", async () => {
        const handler = handlers.get("get_release")!;
        const result = await handler(makeCtx({
          owner: "user",
          repo: "repo",
          release_id: 1,
        }));

        expect(result).toContain("v1.0.0");
        expect(result).toContain("正式版");
        expect(result).toContain("alice");
        expect(result).toContain("app.zip");
        expect(result).toContain("100");
      });

      it("API 出错时应返回错误消息", async () => {
        octokit.rest.repos.getRelease.mockRejectedValueOnce(new Error("Not Found"));

        const handler = handlers.get("get_release")!;
        const result = await handler(makeCtx({
          owner: "user",
          repo: "repo",
          release_id: 999,
        }));
        expect(result).toContain("获取 Release 详情失败");
        expect(result).toContain("Not Found");
      });
    });

    describe("create_release", () => {
      it("应成功创建 Release", async () => {
        const handler = handlers.get("create_release")!;
        const result = await handler(makeCtx({
          owner: "user",
          repo: "repo",
          tag_name: "v2.0.0",
          name: "正式版 2.0",
        }));

        expect(octokit.rest.repos.createRelease).toHaveBeenCalledOnce();
        expect(result).toContain("创建成功");
        expect(result).toContain("v2.0.0");
      });
    });
  });
});
