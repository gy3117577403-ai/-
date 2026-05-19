"use server";

import { revalidatePath } from "next/cache";
import type { ItemCategory, PaymentStatus, PurchaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createLog } from "@/lib/actions/log";
import {
  buildBatchPaymentCompletedMessage,
  buildBatchPaymentApprovalMessage,
  buildBatchPurchaseApprovalMessage,
  resolveAppBaseUrl,
  sendWeComMessage,
} from "@/lib/wecom";

type CreatePurchaseItemInput = {
  itemName: string;
  quantity: number;
  estimatedCost: number;
  link?: string;
};

type CreatePurchaseInput = {
  applicant: string;
  category: ItemCategory;
  items: CreatePurchaseItemInput[];
};

type BatchPaymentRequestInput = {
  settlementType: string;
  supplierName: string;
  supplierAccount: string;
  supplierBank: string;
};

type BatchReimbursementInput = {
  name: string;
  card: string;
  bank: string;
};

const LARGE_AMOUNT_THRESHOLD = 500;
const PUBLIC_PAYMENT_PENDING_STATUSES: PaymentStatus[] = [
  "PENDING_FUNDS",
  "APPROVING",
];
const PUBLIC_PAYMENT_APPROVED_STATUSES: PaymentStatus[] = ["APPROVED_FUNDS"];
const REIMBURSEMENT_PENDING_STATUSES: PaymentStatus[] = [
  "PENDING_REIMBURSEMENT",
];
const REIMBURSEMENT_APPROVED_STATUSES: PaymentStatus[] = [
  "APPROVED_REIMBURSEMENT",
];
function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function resolvePaymentAmount(row: {
  actualCost: number | null;
  estimatedCost: number;
}) {
  const actual = Number(row.actualCost);
  if (Number.isFinite(actual) && actual > 0) return roundMoney(actual);

  const estimated = Number(row.estimatedCost);
  if (Number.isFinite(estimated) && estimated > 0) {
    return roundMoney(estimated);
  }

  return 0;
}

export async function getPurchases() {
  return prisma.purchaseRequest.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function getPendingTasksCountAction(): Promise<number> {
  const session = await getSession();
  if (!session) return 0;

  if (session.role === "BOSS" || session.role === "ADMIN") {
    return prisma.purchaseRequest.count({ where: { status: "PENDING" } });
  }
  if (session.role === "PURCHASER") {
    return prisma.purchaseRequest.count({ where: { status: "APPROVED" } });
  }
  return 0;
}

export async function createPurchaseAction(data: CreatePurchaseInput) {
  const session = await getSession();
  if (!session) throw new Error("未登录");

  const applicant = data.applicant.trim();
  if (!applicant) throw new Error("请填写申请人");
  if (!data.items?.length) throw new Error("请至少添加一项物资");

  const items = data.items.map((item, index) => {
    const itemName = item.itemName.trim();
    const quantity = Number(item.quantity);
    const estimatedCost = roundMoney(Number(item.estimatedCost));

    if (!itemName) throw new Error(`第 ${index + 1} 项物资名称不能为空`);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`第 ${index + 1} 项数量必须为大于 0 的整数`);
    }
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
      throw new Error(`第 ${index + 1} 项预估金额不能为负`);
    }

    return {
      itemName,
      quantity,
      estimatedCost,
      link: item.link?.trim() || null,
    };
  });

  const now = Date.now();

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.createMany({
      data: items.map((item, index) => ({
        requestNo: `PR-${now}-${String(index + 1).padStart(2, "0")}`,
        applicant,
        itemName: item.itemName,
        quantity: item.quantity,
        estimatedCost: item.estimatedCost,
        category: data.category,
        link: item.link,
        status: "PENDING",
      })),
    });
  });

  revalidatePath("/purchases");

  const totalAmount = items.reduce((sum, item) => sum + item.estimatedCost, 0);
  await sendWeComMessage(
    buildBatchPurchaseApprovalMessage({
      applicant,
      firstItemName: items[0].itemName,
      itemCount: items.length,
      totalAmount,
    })
  );
}

export async function createPurchase(data: CreatePurchaseInput) {
  return createPurchaseAction(data);
}

export async function batchApprovePurchasesAction(ids: string[]) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (session.role !== "BOSS" && session.role !== "ADMIN") {
    throw new Error("无批量审批权限");
  }

  const cleanIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (!cleanIds.length) throw new Error("请至少选择一张请购单");

  const selected = await prisma.$transaction(async (tx) => {
    const rows = await tx.purchaseRequest.findMany({
      where: { id: { in: cleanIds }, status: "PENDING" },
      select: {
        id: true,
        requestNo: true,
        applicant: true,
        itemName: true,
      },
    });

    if (rows.length !== cleanIds.length) {
      throw new Error("仅待审批单据可批量同意，请刷新后重试");
    }

    const updated = await tx.purchaseRequest.updateMany({
      where: { id: { in: cleanIds }, status: "PENDING" },
      data: { status: "APPROVED" },
    });

    if (updated.count !== cleanIds.length) {
      throw new Error("部分请购单审批失败，请刷新后重试");
    }

    return rows;
  });

  await createLog(
    session.name,
    "批量同意",
    "物品采购",
    `批量同意 ${cleanIds.length} 张请购单：${selected
      .map((row) => row.requestNo)
      .join("、")}`
  );

  revalidatePath("/purchases");

  const applicants = Array.from(
    new Set(selected.map((row) => row.applicant.trim()).filter(Boolean))
  ).join("、");
  void sendWeComMessage(
    `✅ **采购审批通过通知（批量）**\n` +
      `申请人：${applicants || "未记录"}\n` +
      `通过单数：${cleanIds.length} 单\n` +
      `主要物资：${selected[0]?.itemName ?? "-"} 等共 ${cleanIds.length} 项\n\n` +
      `<font color="info">@${applicants || "相关申请人"}</font> 你提交的采购申请已审批通过，请关注后续采购进度。`
  );
}

export async function batchRejectPurchasesAction(
  ids: string[],
  reason?: string
) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (session.role !== "BOSS" && session.role !== "ADMIN") {
    throw new Error("无批量驳回权限");
  }

  const cleanIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (!cleanIds.length) throw new Error("请至少选择一张请购单");

  const remark = reason?.trim() || "批量驳回";

  const selected = await prisma.$transaction(async (tx) => {
    const rows = await tx.purchaseRequest.findMany({
      where: { id: { in: cleanIds }, status: "PENDING" },
      select: {
        id: true,
        requestNo: true,
      },
    });

    if (rows.length !== cleanIds.length) {
      throw new Error("仅待审批单据可批量驳回，请刷新后重试");
    }

    const updated = await tx.purchaseRequest.updateMany({
      where: { id: { in: cleanIds }, status: "PENDING" },
      data: { status: "REJECTED", remark },
    });

    if (updated.count !== cleanIds.length) {
      throw new Error("部分请购单驳回失败，请刷新后重试");
    }

    return rows;
  });

  await createLog(
    session.name,
    "批量驳回",
    "物品采购",
    `批量驳回 ${cleanIds.length} 张请购单：${selected
      .map((row) => row.requestNo)
      .join("、")}；原因：${remark}`
  );

  revalidatePath("/purchases");
}

export async function createBatchPaymentRequest(
  ids: string[],
  paymentData: BatchPaymentRequestInput
) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (session.role !== "PURCHASER" && session.role !== "ADMIN") {
    throw new Error("无合并请款权限");
  }

  const cleanIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (!cleanIds.length) throw new Error("请至少选择一张采购单");

  const settlementType = paymentData.settlementType.trim();
  const supplierName = paymentData.supplierName.trim();
  const supplierAccount = paymentData.supplierAccount.trim();
  const supplierBank = paymentData.supplierBank.trim();

  if (!settlementType) throw new Error("请选择结算方式");
  if (!supplierName) throw new Error("请填写供方名称");
  if (!supplierAccount) throw new Error("请填写对公账号");
  if (!supplierBank) throw new Error("请填写开户行");

  const selected = await prisma.$transaction(async (tx) => {
    const rows = await tx.purchaseRequest.findMany({
      where: { id: { in: cleanIds } },
      select: {
        id: true,
        requestNo: true,
        actualCost: true,
        estimatedCost: true,
        paymentStatus: true,
      },
    });

    if (rows.length !== cleanIds.length) {
      throw new Error("部分采购单不存在，请刷新后重试");
    }

    const locked = rows.find((row) => row.paymentStatus !== "UNPAID");
    if (locked) {
      throw new Error("所选单据中存在已进入资金流程的记录，请勿重复提交请款");
    }

    const updated = await tx.purchaseRequest.updateMany({
      where: { id: { in: cleanIds } },
      data: {
        paymentStatus: "PENDING_FUNDS",
        settlementType,
        supplierName,
        supplierAccount,
        supplierBank,
      },
    });

    if (updated.count !== cleanIds.length) {
      throw new Error("部分采购单更新失败，请刷新后重试");
    }

    return rows;
  });

  const totalAmount = selected.reduce(
    (sum, row) => sum + resolvePaymentAmount(row),
    0
  );
  const baseUrl = resolveAppBaseUrl();
  const paymentUrl = baseUrl ? `${baseUrl}/purchases` : "/purchases";

  await sendWeComMessage(
    buildBatchPaymentApprovalMessage({
      supplierName,
      settlementType,
      requestCount: cleanIds.length,
      totalAmount,
      supplierBank,
      supplierAccount,
      paymentUrl,
    })
  );

  await createLog(
    session.name,
    "合并请款",
    "物品采购",
    `合并发起 ${cleanIds.length} 张采购单请款：${selected
      .map((row) => row.requestNo)
      .join("、")}`
  );

  revalidatePath("/purchases");
}

export async function submitBatchReimbursementAction(
  ids: string[],
  rData: BatchReimbursementInput
) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (session.role !== "ADMIN" && session.role !== "PURCHASER") {
    throw new Error("无报销申请权限");
  }

  const cleanIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (!cleanIds.length) throw new Error("请至少选择一张采购单");

  const reimbursementName = rData.name.trim();
  const reimbursementCard = rData.card.trim();
  const reimbursementBank = rData.bank.trim();
  if (!reimbursementName || !reimbursementCard || !reimbursementBank) {
    throw new Error("请完整填写报销收款人、银行卡号和开户行");
  }

  const selected = await prisma.$transaction(async (tx) => {
    const rows = await tx.purchaseRequest.findMany({
      where: { id: { in: cleanIds } },
      select: {
        id: true,
        requestNo: true,
        actualCost: true,
        estimatedCost: true,
        paymentStatus: true,
      },
    });

    if (rows.length !== cleanIds.length) {
      throw new Error("部分采购单不存在，请刷新后重试");
    }

    const locked = rows.find((row) =>
      [
        "PENDING_FUNDS",
        "APPROVING",
        "APPROVED_FUNDS",
        "PENDING_REIMBURSEMENT",
        "APPROVED_REIMBURSEMENT",
        "PAID",
        "REIMBURSED",
      ].includes(row.paymentStatus)
    );
    if (locked) {
      throw new Error("所选单据中存在已进入打款或报销流程的记录，请勿混合提交");
    }

    const updated = await tx.purchaseRequest.updateMany({
      where: { id: { in: cleanIds } },
      data: {
        paymentStatus: "PENDING_REIMBURSEMENT",
        settlementType: "采购垫付",
        reimbursementName,
        reimbursementCard,
        reimbursementBank,
      },
    });

    if (updated.count !== cleanIds.length) {
      throw new Error("部分采购单报销提交失败，请刷新后重试");
    }

    return rows;
  });

  const totalAmount = selected.reduce(
    (sum, row) => sum + resolvePaymentAmount(row),
    0
  );
  const baseUrl = resolveAppBaseUrl();
  const reimbursementUrl = baseUrl ? `${baseUrl}/purchases` : "/purchases";

  await createLog(
    session.name,
    "发起合并报销",
    "物品采购",
    `发起 ${cleanIds.length} 张采购垫付单据报销，收款人 ${reimbursementName}`
  );

  revalidatePath("/purchases");

  void sendWeComMessage(
    `🧾 **采购个人垫付报销申请**\n` +
      `报销人：${reimbursementName}\n` +
      `申请单数：${cleanIds.length} 单\n` +
      `报销总额：<font color="warning">${totalAmount.toFixed(2)}元</font>\n\n` +
      `<font color="info">@邓总</font> 采购提交了个人垫付合并报销，请核对后审批。\n\n` +
      `[👉 点击这里前往系统审批报销](${reimbursementUrl})`
  );
}

export async function confirmBatchPaymentAction(ids: string[]) {
  return approveBatchPaymentAction(ids);
}

export async function approveBatchPaymentAction(ids: string[]) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (session.role !== "BOSS" && session.role !== "ADMIN") {
    throw new Error("无批准打款权限");
  }

  const cleanIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (!cleanIds.length) throw new Error("请至少选择一张采购单");
  const approvedAt = new Date();

  const selected = await prisma.$transaction(async (tx) => {
    const rows = await tx.purchaseRequest.findMany({
      where: { id: { in: cleanIds } },
      select: {
        id: true,
        requestNo: true,
        supplierName: true,
        supplierAccount: true,
        supplierBank: true,
        reimbursementName: true,
        reimbursementCard: true,
        reimbursementBank: true,
        actualCost: true,
        estimatedCost: true,
        paymentStatus: true,
      },
    });

    if (rows.length !== cleanIds.length) {
      throw new Error("部分采购单不存在，请刷新后重试");
    }

    const isPublicPayment = rows.every((row) =>
      PUBLIC_PAYMENT_PENDING_STATUSES.includes(row.paymentStatus)
    );
    const isReimbursement = rows.every((row) =>
      REIMBURSEMENT_PENDING_STATUSES.includes(row.paymentStatus)
    );

    if (!isPublicPayment && !isReimbursement) {
      throw new Error("请勿混合审批对公打款与个人报销单据");
    }

    const updated = await tx.purchaseRequest.updateMany({
      where: {
        id: { in: cleanIds },
        paymentStatus: {
          in: isReimbursement
            ? REIMBURSEMENT_PENDING_STATUSES
            : PUBLIC_PAYMENT_PENDING_STATUSES,
        },
      },
      data: {
        paymentStatus: isReimbursement
          ? "APPROVED_REIMBURSEMENT"
          : "APPROVED_FUNDS",
        paymentApprovedAt: approvedAt,
      },
    });

    if (updated.count !== cleanIds.length) {
      throw new Error("部分采购单审批失败，请刷新后重试");
    }

    return rows;
  });

  const isReimbursement = selected.every((row) =>
    REIMBURSEMENT_PENDING_STATUSES.includes(row.paymentStatus)
  );
  const supplierName =
    selected.find((row) => row.supplierName?.trim())?.supplierName?.trim() ??
    "未记录供应商";
  const reimbursementName =
    selected.find((row) => row.reimbursementName?.trim())?.reimbursementName?.trim() ??
    "未记录报销人";
  const totalAmount = selected.reduce(
    (sum, row) => sum + resolvePaymentAmount(row),
    0
  );

  await createLog(
    session.name,
    isReimbursement ? "批准报销" : "批准打款",
    "物品采购",
    `批准 ${cleanIds.length} 张采购单${isReimbursement ? "报销" : "打款"}：${selected
      .map((row) => row.requestNo)
      .join("、")}`
  );

  revalidatePath("/purchases");

  if (isReimbursement) {
    void sendWeComMessage(
      `✅ **老板已批准采购垫付报销**\n` +
        `报销人：${reimbursementName}\n` +
        `批准单数：${cleanIds.length} 单\n` +
        `批准金额：<font color="warning">${totalAmount.toFixed(2)}元</font>\n\n` +
        `<font color="info">@财务</font> 老板已批准采购 ${reimbursementName} 的报销申请，请财务打款。`
    );
  } else {
    void sendWeComMessage(
      `✅ **老板已批准打款**\n` +
        `供应商：${supplierName}\n` +
        `批准单数：${cleanIds.length} 单\n` +
        `批准金额：<font color="warning">${totalAmount.toFixed(2)}元</font>\n\n` +
        `<font color="info">@财务</font> 老板已批准给 ${supplierName} 供方打款，请财务执行。`
    );
  }
}

export async function financeConfirmPaymentAction(ids: string[]) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (
    session.role !== "ADMIN" &&
    session.role !== "BOSS" &&
    session.role !== "PURCHASER"
  ) {
    throw new Error("无财务确认打款权限");
  }

  const cleanIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (!cleanIds.length) throw new Error("请至少选择一张采购单");

  const selected = await prisma.$transaction(async (tx) => {
    const rows = await tx.purchaseRequest.findMany({
      where: { id: { in: cleanIds } },
      select: {
        id: true,
        requestNo: true,
        supplierName: true,
        reimbursementName: true,
        reimbursementCard: true,
        reimbursementBank: true,
        actualCost: true,
        estimatedCost: true,
        paymentStatus: true,
      },
    });

    if (rows.length !== cleanIds.length) {
      throw new Error("部分采购单不存在，请刷新后重试");
    }

    const isPublicPayment = rows.every((row) =>
      PUBLIC_PAYMENT_APPROVED_STATUSES.includes(row.paymentStatus)
    );
    const isReimbursement = rows.every((row) =>
      REIMBURSEMENT_APPROVED_STATUSES.includes(row.paymentStatus)
    );

    if (!isPublicPayment && !isReimbursement) {
      throw new Error("请勿混合确认对公打款与个人报销单据");
    }

    const updated = await tx.purchaseRequest.updateMany({
      where: {
        id: { in: cleanIds },
        paymentStatus: {
          in: isReimbursement
            ? REIMBURSEMENT_APPROVED_STATUSES
            : PUBLIC_PAYMENT_APPROVED_STATUSES,
        },
      },
      data: { paymentStatus: isReimbursement ? "REIMBURSED" : "PAID" },
    });

    if (updated.count !== cleanIds.length) {
      throw new Error("部分采购单打款状态更新失败，请刷新后重试");
    }

    return rows;
  });

  const isReimbursement = selected.every((row) =>
    REIMBURSEMENT_APPROVED_STATUSES.includes(row.paymentStatus)
  );
  const supplierName =
    selected.find((row) => row.supplierName?.trim())?.supplierName?.trim() ??
    "未记录供应商";
  const reimbursementName =
    selected.find((row) => row.reimbursementName?.trim())?.reimbursementName?.trim() ??
    "未记录报销人";
  const totalAmount = selected.reduce(
    (sum, row) => sum + resolvePaymentAmount(row),
    0
  );

  await createLog(
    session.name,
    isReimbursement ? "财务确认报销打款" : "财务确认打款",
    "物品采购",
    `财务确认 ${cleanIds.length} 张采购单${isReimbursement ? "已报销打款" : "已打款"}：${selected
      .map((row) => row.requestNo)
      .join("、")}`
  );

  revalidatePath("/purchases");

  if (isReimbursement) {
    void sendWeComMessage(
      `✅ **个人垫付报销款已到账**\n` +
        `报销人：${reimbursementName}\n` +
        `报销单数：${cleanIds.length} 单\n` +
        `报销总额：<font color="warning">${totalAmount.toFixed(2)}元</font>\n\n` +
        `<font color="info">@${reimbursementName}</font> 您的采购个人垫付报销款已打入账户，请查收。`
    );
  } else {
    void sendWeComMessage(
      buildBatchPaymentCompletedMessage({
        supplierName,
        requestCount: cleanIds.length,
        totalAmount,
      })
    );
  }
}

export async function getHistoricalSupplierInfoAction(supplierName: string) {
  const session = await getSession();
  if (!session) throw new Error("未登录");

  const name = supplierName.trim();
  if (!name) return null;

  const record = await prisma.purchaseRequest.findFirst({
    where: {
      supplierName: name,
      supplierAccount: { not: null },
      supplierBank: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      supplierAccount: true,
      supplierBank: true,
    },
  });

  if (!record?.supplierAccount?.trim() || !record.supplierBank?.trim()) {
    return null;
  }

  return {
    supplierAccount: record.supplierAccount,
    supplierBank: record.supplierBank,
  };
}

export async function getHistoricalSupplierNamesAction() {
  const session = await getSession();
  if (!session) throw new Error("未登录");

  const records = await prisma.purchaseRequest.findMany({
    where: {
      supplierName: { not: null },
      supplierAccount: { not: null },
      supplierBank: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    distinct: ["supplierName"],
    select: {
      supplierName: true,
    },
    take: 50,
  });

  return records
    .map((record) => record.supplierName?.trim())
    .filter((name): name is string => Boolean(name));
}

export async function getHistoricalReimbursementInfoAction(name: string) {
  const session = await getSession();
  if (!session) throw new Error("未登录");

  const reimbursementName = name.trim();
  if (!reimbursementName) return null;

  const record = await prisma.purchaseRequest.findFirst({
    where: {
      reimbursementName,
      reimbursementCard: { not: null },
      reimbursementBank: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      reimbursementCard: true,
      reimbursementBank: true,
    },
  });

  if (!record?.reimbursementCard?.trim() || !record.reimbursementBank?.trim()) {
    return null;
  }

  return {
    card: record.reimbursementCard,
    bank: record.reimbursementBank,
  };
}

export async function getHistoricalReimbursementNamesAction() {
  const session = await getSession();
  if (!session) throw new Error("未登录");

  const records = await prisma.purchaseRequest.findMany({
    where: {
      reimbursementName: { not: null },
      reimbursementCard: { not: null },
      reimbursementBank: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    distinct: ["reimbursementName"],
    select: {
      reimbursementName: true,
    },
    take: 50,
  });

  return records
    .map((record) => record.reimbursementName?.trim())
    .filter((value): value is string => Boolean(value));
}

export async function markAsContracted(ids: string[]) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (
    session.role !== "ADMIN" &&
    session.role !== "BOSS" &&
    session.role !== "PURCHASER"
  ) {
    throw new Error("无合同状态同步权限");
  }

  const cleanIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (!cleanIds.length) return;

  await prisma.purchaseRequest.updateMany({
    where: {
      id: { in: cleanIds },
      status: { in: ["APPROVED", "ORDERED"] },
    },
    data: {
      status: "ORDERED",
    },
  });

  revalidatePath("/purchases");
}

function assertPurchaseTransition(
  role: string,
  prev: PurchaseStatus,
  next: PurchaseStatus
) {
  if (prev === "PENDING" && (next === "APPROVED" || next === "REJECTED")) {
    if (role !== "BOSS" && role !== "ADMIN") {
      throw new Error("无审批权限");
    }
    return;
  }
  if (prev === "APPROVED" && next === "ORDERED") {
    if (role !== "PURCHASER" && role !== "ADMIN") {
      throw new Error("无采购执行权限");
    }
    return;
  }
  if (prev === "ORDERED" && next === "RECEIVED") {
    if (role !== "PURCHASER" && role !== "ADMIN") {
      throw new Error("无入库确认权限");
    }
    return;
  }
  throw new Error("不允许的状态变更");
}

export async function updatePurchaseStatus(
  id: string,
  newStatus: PurchaseStatus,
  remark?: string
) {
  const session = await getSession();
  if (!session) throw new Error("未登录");

  const row = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!row) throw new Error("请购单不存在");

  if (newStatus === "ORDERED") {
    throw new Error("请通过“标记已采购”表单登记实际金额与合同信息");
  }

  assertPurchaseTransition(session.role, row.status, newStatus);

  if (newStatus === "RECEIVED") {
    await prisma.$transaction(async (tx) => {
      const req = await tx.purchaseRequest.update({
        where: { id },
        data: { status: newStatus, remark: remark?.trim() || null },
      });

      await tx.jigBaseInventory.upsert({
        where: { modelCode: req.itemName },
        update: { quantity: { increment: req.quantity } },
        create: {
          modelCode: req.itemName,
          quantity: req.quantity,
          category: req.category,
        },
      });
    });

    revalidatePath("/purchases");
    revalidatePath("/jig-inventory");

    void sendWeComMessage(
      `📦 **到货入库提醒**\n` +
        `> 申请人：${row.applicant}\n` +
        `> 物资：${row.itemName} x ${row.quantity}\n\n` +
        `<font color="info">@${row.applicant}</font> 你申请的物资已经入库，请留意。`
    );

    await createLog(
      session.name,
      "状态变更",
      "物品采购",
      `将请购单 ${row.requestNo} 的状态修改为: ${newStatus}`
    );

    return;
  }

  await prisma.purchaseRequest.update({
    where: { id },
    data: { status: newStatus, remark: remark?.trim() || null },
  });

  if (newStatus === "APPROVED") {
    void sendWeComMessage(
      `✅ **采购申请已批准**\n` +
        `> 申请人：${row.applicant}\n` +
        `> 物资：${row.itemName}\n\n` +
        `<font color="info">@王伟红</font> 单据已批，请尽快下单购买。`
    );
  }

  await createLog(
    session.name,
    "状态变更",
    "物品采购",
    `将请购单 ${row.requestNo} 的状态修改为: ${newStatus}`
  );

  revalidatePath("/purchases");
}

export async function markOrderedWithDetailsAction(
  id: string,
  actualCost: number,
  contractNo?: string | null,
  invoiceNo?: string | null
) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (session.role !== "PURCHASER" && session.role !== "ADMIN") {
    throw new Error("无采购执行权限");
  }

  const row = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!row) throw new Error("请购单不存在");
  if (row.status !== "APPROVED") {
    throw new Error("仅已批准请购单可标记已采购");
  }

  const cost = roundMoney(Number(actualCost));
  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error("实际金额无效");
  }
  if (cost === 0) {
    throw new Error("实际金额须大于 0");
  }

  const trimmedContract = contractNo?.trim() || null;
  const trimmedInvoice = invoiceNo?.trim() || null;

  let paymentStatus: PaymentStatus = "UNPAID";
  let finalContract: string | null = trimmedContract;

  if (cost >= LARGE_AMOUNT_THRESHOLD) {
    if (!trimmedContract) {
      throw new Error("实际金额达到或超过 500 元时，必须填写合同编号");
    }
    paymentStatus = "PENDING_FUNDS";
    finalContract = trimmedContract;
  }

  await prisma.purchaseRequest.update({
    where: { id },
    data: {
      status: "ORDERED",
      actualCost: cost,
      contractNo: finalContract,
      invoiceNo: trimmedInvoice,
      paymentStatus,
    },
  });

  await createLog(
    session.name,
    "标记已采购",
    "物品采购",
    `请购单 ${row.requestNo} 已采购，实际金额 ${cost} 元，付款状态 ${paymentStatus}`
  );

  revalidatePath("/purchases");
}

export async function markAsPaidAction(id: string) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (session.role !== "BOSS" && session.role !== "ADMIN") {
    throw new Error("无付款确认权限");
  }

  const row = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!row) throw new Error("请购单不存在");
  if (row.status !== "ORDERED" && row.status !== "RECEIVED") {
    throw new Error("仅已采购或已入库单据可标记为已付款");
  }

  await prisma.purchaseRequest.update({
    where: { id },
    data: { paymentStatus: "PAID" },
  });

  await createLog(
    session.name,
    "标记已付款",
    "物品采购",
    `请购单 ${row.requestNo} 已标记为已付款`
  );

  revalidatePath("/purchases");
}

export async function updateInvoiceNoAction(id: string, invoiceNo: string) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (
    session.role !== "ADMIN" &&
    session.role !== "BOSS" &&
    session.role !== "PURCHASER"
  ) {
    throw new Error("无发票录入权限");
  }

  const row = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!row) throw new Error("请购单不存在");
  if (row.status !== "ORDERED" && row.status !== "RECEIVED") {
    throw new Error("仅已采购或已入库单据可维护发票号");
  }

  const trimmed = invoiceNo.trim();

  await prisma.purchaseRequest.update({
    where: { id },
    data: { invoiceNo: trimmed ? trimmed : null },
  });

  await createLog(
    session.name,
    "发票记录",
    "物品采购",
    `请购单 ${row.requestNo} 发票号已更新`
  );

  revalidatePath("/purchases");
}

export async function updateSupplierInfoAction(
  id: string,
  data: {
    supplierName: string;
    supplierAccount: string;
    supplierBank: string;
  }
) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (session.role !== "ADMIN" && session.role !== "PURCHASER") {
    throw new Error("无供应商信息编辑权限");
  }

  const row = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!row) throw new Error("采购单不存在");
  if (row.paymentStatus === "PAID" || row.paymentStatus === "REIMBURSED") {
    throw new Error("已完成付款或报销的单据禁止修改供应商信息");
  }

  const supplierName = data.supplierName.trim();
  const supplierAccount = data.supplierAccount.trim();
  const supplierBank = data.supplierBank.trim();

  if (!supplierName) {
    throw new Error("供应商名称不能为空");
  }

  await prisma.purchaseRequest.update({
    where: { id },
    data: {
      supplierName,
      supplierAccount: supplierAccount || null,
      supplierBank: supplierBank || null,
    },
  });

  await createLog(
    session.name,
    "编辑供应商信息",
    "物品采购",
    `采购单 ${row.requestNo} 供应商信息已更新`
  );

  revalidatePath("/purchases");
}

export async function updatePurchaseSettlementTypeAction(
  id: string,
  settlementType: string
) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (session.role !== "ADMIN" && session.role !== "PURCHASER") {
    throw new Error("无结算方式编辑权限");
  }

  const nextSettlementType = settlementType.trim();
  const allowedSettlementTypes = ["采购垫付", "对公现结", "月结"];
  if (!allowedSettlementTypes.includes(nextSettlementType)) {
    throw new Error("结算方式无效");
  }

  const row = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!row) throw new Error("采购单不存在");
  if (row.paymentStatus === "PAID" || row.paymentStatus === "REIMBURSED") {
    throw new Error("已完成结算的单据无法修改结算方式");
  }

  await prisma.purchaseRequest.update({
    where: { id },
    data: { settlementType: nextSettlementType },
  });

  await createLog(
    session.name,
    "修改结算方式",
    "物品采购",
    `采购单 ${row.requestNo} 结算方式已更新为 ${nextSettlementType}`
  );

  revalidatePath("/purchases");
}

export async function deletePurchaseRequest(id: string) {
  const session = await getSession();
  if (!session) throw new Error("未登录");

  const row = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!row) throw new Error("请购单不存在");

  if (session.role === "ADMIN") {
    if (row.status === "RECEIVED") {
      await prisma.$transaction(async (tx) => {
        await tx.purchaseRequest.delete({ where: { id } });

        const adj = await tx.jigBaseInventory.updateMany({
          where: {
            modelCode: row.itemName,
            quantity: { gte: row.quantity },
          },
          data: { quantity: { decrement: row.quantity } },
        });

        if (adj.count === 0) {
          throw new Error(
            "总库无该型号或库存不足以冲减本次入库数量，删除已回滚"
          );
        }
      });
    } else {
      await prisma.purchaseRequest.delete({ where: { id } });
    }

    revalidatePath("/purchases");
    revalidatePath("/jig-inventory");
    return;
  }

  if (row.status !== "PENDING") {
    throw new Error("仅待审批请购单可删除");
  }

  if (session.role === "ENGINEER") {
    if (row.applicant.trim() !== session.name.trim()) {
      throw new Error("只能删除本人提交的待审批请购单");
    }
  } else {
    throw new Error("无删除权限");
  }

  await prisma.purchaseRequest.delete({ where: { id } });
  revalidatePath("/purchases");
}

export async function cancelPurchaseRequestAction(id: string) {
  const session = await getSession();
  if (!session) throw new Error("未登录");

  const row = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!row) throw new Error("请购单不存在");

  if (row.status !== "PENDING") {
    throw new Error("仅待审批的申请可撤回");
  }

  const applicant = row.applicant.trim();
  const isApplicant =
    applicant === session.name.trim() || applicant === session.userId.trim();

  if (!isApplicant) {
    throw new Error("只能撤回本人提交的申请");
  }

  await prisma.purchaseRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await createLog(
    session.name,
    "撤回申请",
    "物品采购",
    `申请人撤回请购单 ${row.requestNo}，状态已关闭`
  );

  revalidatePath("/purchases");
}

export async function updatePurchaseActualCostAction(
  id: string,
  actualCost: number
) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (session.role !== "ADMIN" && session.role !== "PURCHASER") {
    throw new Error("无实际金额编辑权限");
  }

  const cost = roundMoney(Number(actualCost));
  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error("金额无效");
  }

  const row = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!row) throw new Error("请购单不存在");

  if (row.paymentStatus === "PAID" || row.paymentStatus === "REIMBURSED") {
    throw new Error("已完成付款或报销的单据无法修改金额");
  }

  await prisma.purchaseRequest.update({
    where: { id },
    data: { actualCost: cost },
  });

  await createLog(
    session.name,
    "修改实际金额",
    "物品采购",
    `采购单 ${row.requestNo} 实际金额已更新为 ${cost} 元`
  );

  revalidatePath("/purchases");
}

export async function adminUpdatePurchaseCostAction(
  id: string,
  actualCost: number
) {
  return updatePurchaseActualCostAction(id, actualCost);
}
