"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { PurchaseStatus, ItemCategory, PaymentStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { createLog } from "@/lib/actions/log";
import { resolveAppBaseUrl, sendWeComMessage } from "@/lib/wecom";

export async function getPurchases() {
  return prisma.purchaseRequest.findMany({
    orderBy: { createdAt: "desc" },
  });
}

/** 端内铃铛：领导看待审批数，采购员看待下单数 */
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

export async function createPurchase(data: {
  applicant: string;
  itemName: string;
  quantity: number;
  estimatedCost: number;
  category: ItemCategory;
  link?: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("未登录");

  if (!data.applicant.trim()) throw new Error("请填写申请人");
  if (!data.itemName.trim()) throw new Error("请填写物资型号");
  if (data.quantity < 1) throw new Error("数量必须大于 0");
  if (data.estimatedCost < 0) throw new Error("预估金额不能为负");

  const created = await prisma.purchaseRequest.create({
    data: {
      requestNo: `PR-${Date.now()}`,
      applicant: data.applicant.trim(),
      itemName: data.itemName.trim(),
      quantity: data.quantity,
      estimatedCost: Math.round(data.estimatedCost * 100) / 100,
      category: data.category,
      link: data.link?.trim() || null,
      status: "PENDING",
    },
    select: {
      applicant: true,
      itemName: true,
      quantity: true,
      estimatedCost: true,
    },
  });

  revalidatePath("/purchases");

  const base = resolveAppBaseUrl();
  const linkPart = base
    ? `[👉 点击前往审批](${base}/purchases)`
    : "请配置 NEXT_PUBLIC_APP_URL 后在系统内打开「物品采购审批」";
  const cost = created.estimatedCost.toFixed(2);
  void sendWeComMessage(
    `🔔 **新采购审批提醒**\n` +
      `> 申请人：<font color="info">${created.applicant}</font>\n` +
      `> 物资：${created.itemName} x ${created.quantity}\n` +
      `> 预估金额：<font color="warning">${cost}元</font>\n\n` +
      `<font color="info">@邓总</font> 老板有新的采购单，` +
      linkPart
  );
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
    throw new Error("请通过「标记已采购」表单登记实际金额与合同信息");
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
        `<font color="info">@${row.applicant}</font> 你申请的物资已经入库啦，请留意！`
    );

    await createLog(
      session.name,
      "状态变更",
      "物品采购",
      "将请购单 " + row.requestNo + " 的状态修改为: " + newStatus
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
        `<font color="info">@王伟红</font> 单据已批，请尽快下单购买！`
    );
  }

  await createLog(
    session.name,
    "状态变更",
    "物品采购",
    "将请购单 " + row.requestNo + " 的状态修改为: " + newStatus
  );

  revalidatePath("/purchases");
}

const LARGE_AMOUNT_THRESHOLD = 500;

/** 采购员标记已采购：写入实际金额；≥500 元须合同号并进入付款待审 */
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

  const cost = Math.round(Number(actualCost) * 100) / 100;
  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error("实际金额无效");
  }
  if (cost === 0) {
    throw new Error("实际金额须大于 0");
  }

  const trimmedContract = contractNo?.trim() || null;
  const trimmedInvoice = invoiceNo?.trim() || null;

  let paymentStatus: PaymentStatus = "UNPAID";
  let finalContract: string | null = null;

  if (cost >= LARGE_AMOUNT_THRESHOLD) {
    if (!trimmedContract) {
      throw new Error("实际金额达到或超过 500 元时，必须填写合同编号");
    }
    paymentStatus = "APPROVING";
    finalContract = trimmedContract;
  } else {
    finalContract = trimmedContract;
  }

  await prisma.purchaseRequest.update({
    where: { id },
    data: {
      status: "ORDERED",
      actualCost: cost,
      contractNo: finalContract,
      invoiceNo: trimmedInvoice || null,
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

/** 财务闭环：未付/待审均可一键标记为已付款 */
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

/** 录入/修改发票号 */
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
    "发票补录",
    "物品采购",
    `请购单 ${row.requestNo} 发票号已更新`
  );

  revalidatePath("/purchases");
}

export async function deletePurchaseRequest(id: string) {
  const session = await getSession();
  if (!session) throw new Error("未登录");

  const row = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!row) throw new Error("请购单不存在");

  // 若为管理员，可以无视状态强制删除
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
            "总仓无该型号或库存不足以冲减本次入库数量，删除已回滚"
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

  // 非管理员只能删除 PENDING
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

/** 申请人撤回：仅 PENDING 且本人可申请 */
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
    "申请人撤回请购单 " + row.requestNo + "，状态已关闭"
  );

  revalidatePath("/purchases");
}

/** 管理员补录/修正实际金额（不改变请购状态机） */
export async function adminUpdatePurchaseCostAction(
  id: string,
  actualCost: number
) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (session.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const cost = Math.round(Number(actualCost) * 100) / 100;
  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error("金额无效");
  }

  const row = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!row) throw new Error("请购单不存在");

  await prisma.purchaseRequest.update({
    where: { id },
    data: { actualCost: cost },
  });

  revalidatePath("/purchases");
}
