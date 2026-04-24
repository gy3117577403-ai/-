/**
 * 企业微信机器人 Webhook（markdown）。失败仅打日志，绝不抛错影响主流程。
 */

export function resolveAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return vercel.startsWith("http") ? vercel.replace(/\/$/, "") : `https://${vercel}`;
  }
  return "";
}

export async function sendWeComMessage(markdownContent: string): Promise<void> {
  const url = process.env.WECOM_WEBHOOK_URL?.trim();
  if (!url) {
    console.warn("[wecom] WECOM_WEBHOOK_URL 未配置，已跳过发送");
    return;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msgtype: "markdown",
        markdown: { content: markdownContent },
      }),
    });

    const text = await res.text();
    let body: { errcode?: number; errmsg?: string } = {};
    try {
      body = JSON.parse(text) as { errcode?: number; errmsg?: string };
    } catch {
      /* 非 JSON 响应 */
    }

    if (!res.ok || (typeof body.errcode === "number" && body.errcode !== 0)) {
      console.warn(
        "[wecom] 发送失败",
        res.status,
        body.errmsg ?? text.slice(0, 200)
      );
    }
  } catch (e) {
    console.warn(
      "[wecom] 请求异常（已吞掉，不影响业务）",
      e instanceof Error ? e.message : e
    );
  }
}
