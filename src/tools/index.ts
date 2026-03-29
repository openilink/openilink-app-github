/**
 * Tool 注册中心
 * 收集所有 tool 模块的定义和 handler，统一注册到 Hub
 */
import type { Octokit } from "@octokit/rest";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";

/** Tool 模块接口 */
export interface ToolModule {
  definitions: ToolDefinition[];
  createHandlers: (octokit: Octokit) => Map<string, ToolHandler>;
}

// 导入各 tool 模块
import { reposTools } from "./repos.js";
import { issuesTools } from "./issues.js";
import { pullsTools } from "./pulls.js";
import { actionsTools } from "./actions.js";
import { releasesTools } from "./releases.js";
import { gistsTools } from "./gists.js";
import { notificationsTools } from "./notifications.js";

/** 所有 tool 模块列表 */
const modules: ToolModule[] = [
  reposTools,
  issuesTools,
  pullsTools,
  actionsTools,
  releasesTools,
  gistsTools,
  notificationsTools,
];

/**
 * 收集所有 tool 的定义和处理函数
 * @param octokit GitHub Octokit 实例
 * @returns definitions: 全部 tool 定义列表, handlers: 命令名 → 处理函数映射
 */
export function collectAllTools(octokit: Octokit): {
  definitions: ToolDefinition[];
  handlers: Map<string, ToolHandler>;
} {
  const definitions: ToolDefinition[] = [];
  const handlers = new Map<string, ToolHandler>();

  for (const mod of modules) {
    // 收集定义
    definitions.push(...mod.definitions);

    // 收集处理函数
    const modHandlers = mod.createHandlers(octokit);
    for (const [name, handler] of modHandlers) {
      if (handlers.has(name)) {
        console.warn(`[tools] 工具名称冲突: ${name}，后者将覆盖前者`);
      }
      handlers.set(name, handler);
    }
  }

  console.log(`[tools] 共注册 ${definitions.length} 个工具, ${handlers.size} 个处理函数`);
  return { definitions, handlers };
}
