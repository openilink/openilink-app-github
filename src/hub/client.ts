/**
 * Hub Bot API 客户端 - 用于通过 Hub 向微信用户发送消息
 */
export class HubClient {
  private hubUrl: string;
  private appToken: string;

  constructor(hubUrl: string, appToken: string) {
    this.hubUrl = hubUrl;
    this.appToken = appToken;
  }

  /**
   * 发送文本消息
   * @param to 目标微信用户 ID
   * @param text 文本内容
   * @param traceId 可选的追踪 ID
   */
  async sendText(to: string, text: string, traceId?: string): Promise<void> {
    await this.sendMessage(to, "text", text, traceId);
  }

  /**
   * 同步工具定义到 Hub（PUT /bot/v1/app/tools）
   */
  async syncTools(tools: import("./types.js").ToolDefinition[]): Promise<void> {
    const url = `${this.hubUrl}/bot/v1/app/tools`;
    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.appToken}`,
      },
      body: JSON.stringify({ tools }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[hub-client] syncTools 失败 [${resp.status}]: ${errText}`);
    }
  }

  /**
   * 通用消息发送方法
   * @param to 目标微信用户 ID
   * @param type 消息类型（text 等）
   * @param content 消息内容
   * @param traceId 可选的追踪 ID
   */
  async sendMessage(
    to: string,
    type: string,
    content: string,
    traceId?: string,
  ): Promise<void> {
    const url = `${this.hubUrl}/api/bot/send`;

    const payload: Record<string, string> = {
      to,
      type,
      content,
    };
    if (traceId) {
      payload.trace_id = traceId;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.appToken}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `[hub-client] 发送消息失败: ${res.status} ${res.statusText} - ${errText}`,
      );
    }
  }
}
