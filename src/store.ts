import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Installation } from "./hub/types.js";
import { encryptConfig, decryptConfig } from "./utils/config-crypto.js";

/**
 * SQLite 存储层 - 管理安装凭证
 */
export class Store {
  private db: Database.Database;

  constructor(dbPath: string) {
    // 确保目录存在
    const dir = dirname(dbPath);
    if (dir && dir !== ".") mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS installations (
        id TEXT PRIMARY KEY,
        hub_url TEXT NOT NULL,
        app_id TEXT NOT NULL,
        bot_id TEXT NOT NULL,
        app_token TEXT NOT NULL,
        webhook_secret TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    /** 追加 encrypted_config 列（已有表平滑迁移） */
    try {
      this.db.exec(`ALTER TABLE installations ADD COLUMN encrypted_config TEXT NOT NULL DEFAULT ''`);
    } catch {
      // 列已存在则忽略
    }
  }

  // ─── 安装管理 ───

  saveInstallation(inst: Installation): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO installations
         (id, hub_url, app_id, bot_id, app_token, webhook_secret, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(inst.id, inst.hubUrl, inst.appId, inst.botId, inst.appToken, inst.webhookSecret);
  }

  getInstallation(id: string): Installation | undefined {
    const row = this.db
      .prepare("SELECT * FROM installations WHERE id = ?")
      .get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      hubUrl: row.hub_url,
      appId: row.app_id,
      botId: row.bot_id,
      appToken: row.app_token,
      webhookSecret: row.webhook_secret,
      createdAt: row.created_at,
    };
  }

  getAllInstallations(): Installation[] {
    const rows = this.db.prepare("SELECT * FROM installations").all() as any[];
    return rows.map((row) => ({
      id: row.id,
      hubUrl: row.hub_url,
      appId: row.app_id,
      botId: row.bot_id,
      appToken: row.app_token,
      webhookSecret: row.webhook_secret,
      createdAt: row.created_at,
    }));
  }

  /* ======================== encrypted_config CRUD ======================== */

  /**
   * 将配置加密后保存到对应安装记录
   * @param installationId - 安装实例 ID
   * @param plainConfig    - 明文配置对象
   * @param appToken       - 用于派生加密密钥的 app_token
   */
  saveConfig(installationId: string, plainConfig: Record<string, string>, appToken: string): void {
    const cipher = encryptConfig(plainConfig, appToken);
    this.db
      .prepare("UPDATE installations SET encrypted_config = ? WHERE id = ?")
      .run(cipher, installationId);
  }

  /**
   * 读取并解密指定安装的配置
   * @param installationId - 安装实例 ID
   * @param appToken       - 用于派生解密密钥的 app_token
   * @returns 解密后的配置对象，若无配置则返回 undefined
   */
  getConfig(installationId: string, appToken: string): Record<string, string> | undefined {
    const row = this.db
      .prepare("SELECT encrypted_config FROM installations WHERE id = ?")
      .get(installationId) as { encrypted_config: string } | undefined;
    if (!row || !row.encrypted_config) return undefined;
    return decryptConfig(row.encrypted_config, appToken);
  }

  close(): void {
    this.db.close();
  }
}
