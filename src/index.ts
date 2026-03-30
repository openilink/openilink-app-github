/**
 * 主入口文件 - 启动 HTTP 服务器
 */
import http from "node:http";
import { Octokit } from "@octokit/rest";
import { loadConfig } from "./config.js";
import { Store } from "./store.js";
import { HubClient } from "./hub/client.js";
import { Router } from "./router.js";
import { handleWebhook } from "./hub/webhook.js";
import { handleOAuthSetup, handleOAuthRedirect } from "./hub/oauth.js";
import { handleSettingsPage, handleSettingsVerify, handleSettingsSave } from "./hub/settings.js";
import { getManifest } from "./hub/manifest.js";
import { collectAllTools } from "./tools/index.js";
import type { HubEvent, Installation } from "./hub/types.js";

/** 解析请求 URL 的路径和方法 */
function parseRequest(req: http.IncomingMessage): { method: string; pathname: string } {
  const method = (req.method ?? "GET").toUpperCase();
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  return { method, pathname: url.pathname };
}

async function main(): Promise<void> {
  // 1. 加载配置
  const config = loadConfig();
  console.log("[main] 配置加载完成");

  // 2. 初始化存储
  const store = new Store(config.dbPath);
  console.log("[main] 数据库初始化完成");

  // 3. 初始化 GitHub Octokit 客户端（如果环境变量中配置了 GitHub Token）
  const hasGithubCredentials = !!config.githubToken;
  const octokit = hasGithubCredentials
    ? new Octokit({ auth: config.githubToken })
    : null;

  if (octokit) {
    console.log("[main] GitHub 客户端初始化完成");
  } else {
    console.log("[main] 未配置 GitHub Token，跳过默认客户端初始化（云端托管模式，用户安装时填写）");
  }

  // 4. 收集所有 tools（如果没有默认客户端则用空 token 客户端仅收集定义）
  const toolsSdkClient = octokit ?? new Octokit();
  const { definitions, handlers } = collectAllTools(toolsSdkClient);
  console.log(`[main] 已注册 ${definitions.length} 个工具`);

  // 5. 初始化路由器
  const router = new Router(handlers);

  /** 获取 HubClient 实例（用于异步回复等场景） */
  function getHubClient(installation: Installation): HubClient {
    return new HubClient(installation.hubUrl, installation.appToken);
  }

  /**
   * 处理 command 事件（同步/异步超时由 webhook 层控制）
   * 优先从本地加密配置中读取 github_token 创建临时 Octokit 客户端
   * 返回工具执行结果文本，null 表示无需回复
   */
  async function onCommand(event: HubEvent, installation: Installation): Promise<string | null> {
    if (!event.event) return null;

    /** 尝试读取本地加密配置，用其中的 github_token 创建临时客户端 */
    const localCfg = store.getConfig(installation.id, installation.appToken);
    let perInstallOctokit = toolsSdkClient;
    if (localCfg?.github_token) {
      perInstallOctokit = new Octokit({ auth: localCfg.github_token });
      console.log(`[main] 使用安装 ${installation.id} 的本地加密 github_token`);
    }

    /** 用 per-installation 客户端重新收集工具处理器 */
    const perHandlers = perInstallOctokit === toolsSdkClient
      ? handlers
      : collectAllTools(perInstallOctokit).handlers;
    const perRouter = perInstallOctokit === toolsSdkClient
      ? router
      : new Router(perHandlers);

    const hubClient = getHubClient(installation);
    const result = await perRouter.handleCommand(event, installation, hubClient);
    return result;
  }

  // 6. 创建 HTTP 服务器
  const server = http.createServer(async (req, res) => {
    const { method, pathname } = parseRequest(req);

    try {
      // POST /hub/webhook - Hub 事件推送
      if (method === "POST" && pathname === "/hub/webhook") {
        await handleWebhook(req, res, { store, onCommand, getHubClient });
        return;
      }

      // GET/POST /oauth/setup - OAuth 安装流程（显示配置表单 / 提交后跳转授权）
      if (pathname === "/oauth/setup" && (method === "GET" || method === "POST")) {
        await handleOAuthSetup(req, res, config);
        return;
      }

      // GET /oauth/redirect - OAuth 回调
      if (method === "GET" && pathname === "/oauth/redirect") {
        await handleOAuthRedirect(req, res, config, store, definitions);
        return;
      }

      // POST /oauth/redirect - 模式 2: Hub 直接安装通知
      if (method === "POST" && pathname === "/oauth/redirect") {
        const body = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          req.on("data", (chunk: Buffer) => chunks.push(chunk));
          req.on("end", () => resolve(Buffer.concat(chunks)));
          req.on("error", reject);
        });
        const data = JSON.parse(body.toString());
        store.saveInstallation({
          id: data.installation_id,
          hubUrl: data.hub_url || config.hubUrl,
          appId: "",
          botId: data.bot_id || "",
          appToken: data.app_token,
          webhookSecret: data.webhook_secret,
          createdAt: new Date().toISOString(),
        });
        console.log("[oauth] 模式2安装成功, installation_id:", data.installation_id);
        // 安装后拉取配置并加密存储
        const mode2Hub = new HubClient(data.hub_url || config.hubUrl, data.app_token);
        mode2Hub.fetchConfig()
          .then((remoteCfg) => {
            if (Object.keys(remoteCfg).length > 0) {
              store.saveConfig(data.installation_id, remoteCfg, data.app_token);
              console.log("[main] 模式2: 已拉取并加密保存配置:", data.installation_id);
            }
          })
          .catch((err) => console.error("[main] 模式2: 拉取配置失败:", err));
        // 异步同步工具定义到 Hub
        mode2Hub.syncTools(definitions)
          .catch((err) => console.error("[oauth] 模式2同步工具失败:", err));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ webhook_url: `${config.baseUrl}/hub/webhook` }));
        return;
      }

      // GET /settings — 设置页面（输入 token 验证身份）
      if (method === "GET" && pathname === "/settings") {
        handleSettingsPage(req, res);
        return;
      }

      // POST /settings/verify — 验证 token 后显示配置表单
      if (method === "POST" && pathname === "/settings/verify") {
        await handleSettingsVerify(req, res, config, store);
        return;
      }

      // POST /settings/save — 保存修改后的配置
      if (method === "POST" && pathname === "/settings/save") {
        await handleSettingsSave(req, res, config, store);
        return;
      }

      // GET /manifest.json - App Manifest
      if (method === "GET" && pathname === "/manifest.json") {
        const manifest = getManifest(config, definitions);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(manifest, null, 2));
        return;
      }

      // GET /health - 健康检查
      if (method === "GET" && pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      // 404
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
    } catch (err) {
      console.error("[main] 请求处理异常:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal Server Error" }));
      }
    }
  });

  // 7. 启动 HTTP 服务器
  const port = parseInt(config.port, 10);
  server.listen(port, () => {
    console.log(`[main] HTTP 服务器已启动，监听端口 ${port}`);
    console.log(`[main] Manifest: http://localhost:${port}/manifest.json`);
    console.log(`[main] Health: http://localhost:${port}/health`);

    // 启动时同步工具定义到所有已安装的 Hub 实例
    const installations = store.getAllInstallations();
    for (const inst of installations) {
      const hubClient = new HubClient(inst.hubUrl, inst.appToken);
      hubClient.syncTools(definitions).catch((err) => {
        console.error(`[main] 启动同步工具失败 (installation=${inst.id}):`, err);
      });
    }
    if (installations.length > 0) {
      console.log(`[main] 正在向 ${installations.length} 个安装实例同步工具定义`);
    }
  });

  // 8. 优雅关闭
  const shutdown = (signal: string) => {
    console.log(`\n[main] 收到 ${signal} 信号，开始优雅关闭...`);
    server.close(() => {
      console.log("[main] HTTP 服务器已关闭");
      store.close();
      console.log("[main] 数据库连接已关闭");
      process.exit(0);
    });

    // 超时强制退出
    setTimeout(() => {
      console.error("[main] 优雅关闭超时，强制退出");
      process.exit(1);
    }, 5000);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// 启动应用
main().catch((err) => {
  console.error("[main] 启动失败:", err);
  process.exit(1);
});
