/**
 * 企业微信机器人 Webhook（markdown）。发送失败只记录日志，不影响主业务流程。
 */

export function resolveAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return vercel.startsWith("http")
      ? vercel.replace(/\/$/, "")
      : `https://${vercel}`;
  }
  return "";
}

export function buildBatchPurchaseApprovalMessage({
  applicant,
  firstItemName,
  itemCount,
  totalAmount,
}: {
  applicant: string;
  firstItemName: string;
  itemCount: number;
  totalAmount: number;
}) {
  return (
    `🔔 **新采购审批 (批量提交)**\n` +
    `申请人：${applicant}\n` +
    `主要物资：${firstItemName} 等共 ${itemCount} 项\n` +
    `合计预估金额：<font color="warning">${totalAmount.toFixed(2)}元</font>\n\n` +
    `<font color="info">@邓总</font> 老板，这是本次批量采购的汇总，请点击前往系统查看明细并一键审批。`
  );
}

export function buildBatchPaymentApprovalMessage({
  supplierName,
  settlementType,
  requestCount,
  totalAmount,
  supplierBank,
  supplierAccount,
  paymentUrl,
}: {
  supplierName: string;
  settlementType: string;
  requestCount: number;
  totalAmount: number;
  supplierBank: string;
  supplierAccount: string;
  paymentUrl: string;
}) {
  return (
    `💰 **财务打款审批提醒**\n` +
    `供应商：${supplierName}\n` +
    `结算方式：${settlementType}\n` +
    `请款单数：${requestCount} 单\n` +
    `请款总额：<font color="warning">${totalAmount.toFixed(2)}元</font>\n\n` +
    `🏦 **账户信息**\n` +
    `开户行：${supplierBank}\n` +
    `账号：${supplierAccount}\n\n` +
    `<font color="info">@邓总</font> 采购发起了合并请款，请核对后审批打款！\n\n` +
    `[👉 点击这里前往系统一键确认打款](${paymentUrl})`
  );
}

export function buildBatchPaymentCompletedMessage({
  supplierName,
  requestCount,
  totalAmount,
}: {
  supplierName: string;
  requestCount: number;
  totalAmount: number;
}) {
  return (
    `✅ **财务打款完成通知**\n` +
    `供应商：${supplierName}\n` +
    `打款单数：${requestCount} 单\n` +
    `打款总额：<font color="warning">${totalAmount.toFixed(2)}元</font>\n\n` +
    `<font color="info">@所有人</font> 老板（财务）已完成该批次单据的审批与打款，请采购知悉并及时跟进发货进度！`
  );
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
      /* non-JSON response */
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
