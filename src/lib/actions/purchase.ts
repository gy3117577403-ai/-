"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { PurchaseStatus, ItemCategory, PaymentStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { createLog } from "@/lib/actions/log";

export async function getPurchases() {
  return prisma.purchaseRequest.findMany({
    orderBy: { createdAt: "desc" },
  });
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

  await prisma.purchaseRequest.create({
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

/** 领导/管理员确认大额付款 */
export async function approvePaymentAction(id: string) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (session.role !== "BOSS" && session.role !== "ADMIN") {
    throw new Error("无付款审批权限");
  }

  const row = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!row) throw new Error("请购单不存在");
  if (row.paymentStatus !== "APPROVING") {
    throw new Error("当前单据不在待付款审批状态");
  }

  await prisma.purchaseRequest.update({
    where: { id },
    data: { paymentStatus: "PAID" },
  });

  await createLog(
    session.name,
    "付款审批",
    "物品采购",
    `请购单 ${row.requestNo} 付款已批准（已付）`
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
