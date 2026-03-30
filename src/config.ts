/**
 * 应用配置 - 从环境变量加载
 * 注意：githubToken 在云端托管模式下为可选，用户会在 OAuth setup 页面自行填写并加密存储到本地数据库。
 */
export interface Config {
  /** HTTP 监听端口 */
  port: string;
  /** OpeniLink Hub 地址 */
  hubUrl: string;
  /** 本 App 的公网地址 */
  baseUrl: string;
  /** SQLite 数据库路径 */
  dbPath: string;
  /** GitHub Personal Access Token（可选，云端托管模式下由用户在安装时填写） */
  githubToken: string;
}

function env(key: string, fallback = ""): string {
  return process.env[key] || fallback;
}

export function loadConfig(): Config {
  const cfg: Config = {
    port: env("PORT", "8088"),
    hubUrl: env("HUB_URL"),
    baseUrl: env("BASE_URL"),
    dbPath: env("DB_PATH", "data/github.db"),
    githubToken: env("GITHUB_TOKEN"),
  };

  // 只有 HUB_URL 和 BASE_URL 是必填，GitHub Token 在云端托管模式下由用户安装时填写
  const missing: string[] = [];
  if (!cfg.hubUrl) missing.push("HUB_URL");
  if (!cfg.baseUrl) missing.push("BASE_URL");

  if (missing.length > 0) {
    throw new Error(`缺少必填环境变量: ${missing.join(", ")}`);
  }

  return cfg;
}
