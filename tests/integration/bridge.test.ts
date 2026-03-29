/**
 * GitHub App 集成测试
 *
 * 测试 Hub ↔ App 的完整通信链路：
 * 1. Mock Hub Server 模拟 OpeniLink Hub
 * 2. 创建轻量 App HTTP 服务器（仅含 webhook handler + router）
 * 3. 使用内存 SQLite 存储 + Mock Octokit
 * 4. 验证命令路由和工具执行
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import http from "node:http";
import { Store } from "../../src/store.js";
import { handleWebhook } from "../../src/hub/webhook.js";
import { HubClient } from "../../src/hub/client.js";
import { Router } from "../../src/router.js";
import { collectAllTools } from "../../src/tools/index.js";
import type { ToolHandler } from "../../src/hub/types.js";
import {
  startMockHub,
  injectCommand,
  getMessages,
  resetMock,
  waitFor,
  MOCK_HUB_URL,
  MOCK_WEBHOOK_SECRET,
  MOCK_APP_TOKEN,
  MOCK_INSTALLATION_ID,
  MOCK_BOT_ID,
  APP_PORT,
} from "./setup.js";

// ─── Mock Octokit ───

function createMockOctokit() {
  return {
    rest: {
      repos: {
        listForAuthenticatedUser: vi.fn().mockResolvedValue({
          data: [
            {
              full_name: "test-user/my-repo",
              private: false,
              stargazers_count: 42,
              description: "测试仓库",
            },
          ],
        }),
        get: vi.fn().mockResolvedValue({
          data: {
            full_name: "test-user/my-repo",
            private: false,
            description: "测试仓库",
            language: "TypeScript",
            stargazers_count: 42,
            forks_count: 5,
            open_issues_count: 3,
            default_branch: "main",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-06-01T00:00:00Z",
            html_url: "https://github.com/test-user/my-repo",
          },
        }),
        createForAuthenticatedUser: vi.fn().mockResolvedValue({
          data: {
            full_name: "test-user/new-repo",
            private: false,
            html_url: "https://github.com/test-user/new-repo",
          },
        }),
      },
      search: {
        repos: vi.fn().mockResolvedValue({
          data: { total_count: 1, items: [{ full_name: "found/repo", private: false, stargazers_count: 100, description: "找到的" }] },
        }),
      },
      issues: {
        listForRepo: vi.fn().mockResolvedValue({
          data: [
            { number: 1, title: "Test Issue", state: "open", labels: [{ name: "bug" }], pull_request: undefined },
          ],
        }),
        create: vi.fn().mockResolvedValue({
          data: { number: 99, title: "New Issue", html_url: "https://github.com/test-user/my-repo/issues/99" },
        }),
        get: vi.fn().mockResolvedValue({
          data: {
            number: 1, title: "Test Issue", state: "open", user: { login: "alice" },
            labels: [{ name: "bug" }], assignees: [], comments: 0,
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
            html_url: "https://github.com/test-user/my-repo/issues/1", body: "描述",
          },
        }),
        update: vi.fn().mockResolvedValue({
          data: { number: 1, title: "Updated", state: "closed" },
        }),
        createComment: vi.fn().mockResolvedValue({
          data: { id: 123, html_url: "https://github.com/test-user/my-repo/issues/1#issuecomment-123" },
        }),
      },
      pulls: {
        list: vi.fn().mockResolvedValue({
          data: [
            { number: 10, title: "Test PR", state: "open", merged_at: null, draft: false, head: { label: "feat" }, base: { label: "main" } },
          ],
        }),
        get: vi.fn().mockResolvedValue({
          data: {
            number: 10, title: "Test PR", state: "open", merged: false,
            user: { login: "alice" }, head: { label: "feat" }, base: { label: "main" },
            requested_reviewers: [], additions: 10, deletions: 2, changed_files: 1,
            comments: 0, review_comments: 0, mergeable: true,
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
            html_url: "https://github.com/test-user/my-repo/pull/10", body: "PR 描述",
          },
        }),
        create: vi.fn().mockResolvedValue({
          data: {
            number: 20, title: "New PR",
            head: { label: "feature" }, base: { label: "main" },
            html_url: "https://github.com/test-user/my-repo/pull/20",
          },
        }),
        merge: vi.fn().mockResolvedValue({
          data: { merged: true, sha: "abc1234", message: "Merged" },
        }),
      },
      actions: {
        listWorkflowRunsForRepo: vi.fn().mockResolvedValue({
          data: {
            total_count: 1,
            workflow_runs: [
              {
                run_number: 1, name: "CI", status: "completed", conclusion: "success",
                head_branch: "main", event: "push",
              },
            ],
          },
        }),
        getWorkflowRun: vi.fn().mockResolvedValue({
          data: {
            run_number: 1, name: "CI", status: "completed", conclusion: "success",
            head_branch: "main", event: "push", actor: { login: "alice" },
            head_sha: "abc1234567890", run_started_at: "2024-01-01T00:00:00Z",
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
            html_url: "https://github.com/test-user/my-repo/actions/runs/1",
          },
        }),
      },
    },
  } as any;
}

// ─── 测试主体 ───

describe("GitHub App 集成测试", () => {
  let mockHubHandle: { server: http.Server; close: () => Promise<void> };
  let appServer: http.Server;
  let store: Store;
  let router: Router;

  beforeAll(async () => {
    // 1. 启动 Mock Hub Server
    mockHubHandle = await startMockHub();

    // 2. 初始化内存数据库和存储
    store = new Store(":memory:");

    // 3. 注入 installation 记录（模拟已完成 OAuth 安装）
    store.saveInstallation({
      id: MOCK_INSTALLATION_ID,
      hubUrl: MOCK_HUB_URL,
      appId: "github",
      botId: MOCK_BOT_ID,
      appToken: MOCK_APP_TOKEN,
      webhookSecret: MOCK_WEBHOOK_SECRET,
      createdAt: new Date().toISOString(),
    });

    // 4. 使用 Mock Octokit 收集工具并创建路由
    const mockOctokit = createMockOctokit();
    const { handlers } = collectAllTools(mockOctokit);
    router = new Router(handlers);

    // 5. 启动轻量 App HTTP 服务器
    appServer = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${APP_PORT}`);

      if (req.method === "POST" && url.pathname === "/hub/webhook") {
        await handleWebhook(req, res, store, async (event, installation) => {
          if (!event.event) return;

          if (event.event.type === "command") {
            const hubClient = new HubClient(installation.hubUrl, installation.appToken);
            const result = await router.handleCommand(event, installation, hubClient);

            if (result) {
              const userId = event.event.data.user_id ?? event.event.data.from ?? "";
              if (userId) {
                try {
                  await hubClient.sendText(userId, result, event.trace_id);
                } catch (err) {
                  console.error("[test] 回复失败:", err);
                }
              }
            }
          }
        });
        return;
      }

      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      res.writeHead(404);
      res.end("Not Found");
    });

    await new Promise<void>((resolve, reject) => {
      appServer.on("error", reject);
      appServer.listen(APP_PORT, () => {
        console.log(`[test] App Server 已启动，端口 ${APP_PORT}`);
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) =>
      appServer.close(() => {
        console.log("[test] App Server 已关闭");
        resolve();
      }),
    );
    await mockHubHandle.close();
    store.close();
  });

  beforeEach(() => {
    resetMock();
  });

  // ─── 基础健康检查 ───

  it("Mock Hub Server 健康检查", async () => {
    const res = await fetch(`${MOCK_HUB_URL}/health`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toEqual({ status: "ok" });
  });

  it("App Server 健康检查", async () => {
    const res = await fetch(`http://localhost:${APP_PORT}/health`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toEqual({ status: "ok" });
  });

  // ─── 命令执行测试 ───

  it("list_repos 命令应通过 Hub 链路返回仓库列表", async () => {
    await injectCommand("list_repos", {});

    await waitFor(async () => {
      const msgs = await getMessages();
      return msgs.length > 0;
    }, 5000);

    const msgs = await getMessages();
    expect(msgs.length).toBe(1);
    expect(msgs[0].to).toBe("test-user");
    expect(msgs[0].type).toBe("text");
    expect(msgs[0].content).toContain("test-user/my-repo");
  });

  it("create_issue 命令应通过 Hub 链路返回创建结果", async () => {
    await injectCommand("create_issue", {
      owner: "test-user",
      repo: "my-repo",
      title: "New Issue from WeChat",
    });

    await waitFor(async () => {
      const msgs = await getMessages();
      return msgs.length > 0;
    }, 5000);

    const msgs = await getMessages();
    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toContain("创建成功");
    expect(msgs[0].content).toContain("#99");
  });

  it("未知命令应返回错误提示", async () => {
    await injectCommand("nonexistent_command", {});

    await waitFor(async () => {
      const msgs = await getMessages();
      return msgs.length > 0;
    }, 5000);

    const msgs = await getMessages();
    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toContain("未知命令");
  });

  // ─── Webhook 验证测试 ───

  it("无效签名的 webhook 请求应被拒绝（401）", async () => {
    const hubEvent = {
      v: 1,
      type: "event",
      trace_id: "tr_bad_sig",
      installation_id: MOCK_INSTALLATION_ID,
      bot: { id: MOCK_BOT_ID },
      event: {
        type: "command",
        id: "evt_bad",
        timestamp: Math.floor(Date.now() / 1000),
        data: { command: "list_repos", args: {}, user_id: "hacker" },
      },
    };

    const res = await fetch(`http://localhost:${APP_PORT}/hub/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": "12345",
        "X-Signature": "sha256=invalid_signature_here",
      },
      body: JSON.stringify(hubEvent),
    });

    expect(res.status).toBe(401);
  });

  it("url_verification 请求应正确返回 challenge", async () => {
    const verifyEvent = {
      v: 1,
      type: "url_verification",
      challenge: "test_challenge_token_123",
    };

    const res = await fetch(`http://localhost:${APP_PORT}/hub/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(verifyEvent),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toEqual({ challenge: "test_challenge_token_123" });
  });

  it("list_pulls 命令应返回 PR 列表", async () => {
    await injectCommand("list_pulls", { owner: "test-user", repo: "my-repo" });

    await waitFor(async () => {
      const msgs = await getMessages();
      return msgs.length > 0;
    }, 5000);

    const msgs = await getMessages();
    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toContain("PR 列表");
    expect(msgs[0].content).toContain("#10");
  });

  it("list_runs 命令应返回工作流运行记录", async () => {
    await injectCommand("list_runs", { owner: "test-user", repo: "my-repo" });

    await waitFor(async () => {
      const msgs = await getMessages();
      return msgs.length > 0;
    }, 5000);

    const msgs = await getMessages();
    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toContain("工作流运行记录");
    expect(msgs[0].content).toContain("CI");
  });
});
