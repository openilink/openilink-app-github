import type { Config } from "../config.js";
import type { ToolDefinition } from "./types.js";

/** Manifest 结构（注册到 Hub 的 App 描述） */
export interface Manifest {
  slug: string;
  name: string;
  description: string;
  icon: string;
  events: string[];
  scopes: string[];
  tools: ToolDefinition[];
  oauth_setup_url: string;
  oauth_redirect_url: string;
  webhook_url: string;
  /** 配置表单 JSON Schema */
  config_schema?: Record<string, unknown>;
  /** 安装引导说明（Markdown） */
  guide?: string;
}

/**
 * 生成完整的 App Manifest，用于向 Hub 注册
 * @param config 应用配置
 * @param toolDefinitions 工具定义列表
 */
export function getManifest(
  config: Config,
  toolDefinitions: ToolDefinition[] = [],
): Manifest {
  const baseUrl = config.baseUrl;

  return {
    slug: "github",
    name: "GitHub",
    description: "通过微信管理 GitHub 仓库、Issue、PR 和 Actions",
    icon: "🐙",
    events: ["command"],
    scopes: ["tools:write", "config:read"],
    tools: toolDefinitions,
    oauth_setup_url: `${baseUrl}/oauth/setup`,
    oauth_redirect_url: `${baseUrl}/oauth/redirect`,
    webhook_url: `${baseUrl}/hub/webhook`,
    config_schema: {
      type: "object",
      properties: {
        github_token: { type: "string", title: "GitHub Personal Access Token", description: "在 GitHub Settings → Developer settings → Personal access tokens 创建" },
      },
      required: ["github_token"],
    },
    guide: "## GitHub 安装指南\n### 第 1 步\n访问 [github.com/settings/tokens](https://github.com/settings/tokens)\n### 第 2 步\nGenerate new token (classic) → 勾选 repo, workflow, read:org, gist, notifications\n### 第 3 步\n复制 Token 填入上方配置并安装",
  };
}
