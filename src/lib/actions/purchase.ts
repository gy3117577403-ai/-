"use server";

import { revalidatePath } from "next/cache";
import type { ItemCategory, PaymentStatus, PurchaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createLog } from "@/lib/actions/log";
import {
  buildBatchPaymentApprovalMessage,
  buildBatchPurchaseApprovalMessage,
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

const LARGE_AMOUNT_THRESHOLD = 500;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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
        estimatedCost: true,
      },
    });

    if (rows.length !== cleanIds.length) {
      throw new Error("部分采购单不存在，请刷新后重试");
    }

    const updated = await tx.purchaseRequest.updateMany({
      where: { id: { in: cleanIds } },
      data: {
        paymentStatus: "APPROVING",
        settlementType,
        supplierAccount,
        supplierBank,
      },
    });

    if (updated.count !== cleanIds.length) {
      throw new Error("部分采购单更新失败，请刷新后重试");
    }

    return rows;
  });

  const totalAmount = selected.reduce((sum, row) => sum + row.estimatedCost, 0);

  await sendWeComMessage(
    buildBatchPaymentApprovalMessage({
      supplierName,
      settlementType,
      requestCount: cleanIds.length,
      totalAmount,
      supplierBank,
      supplierAccount,
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
    paymentStatus = "APPROVING";
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

export async function adminUpdatePurchaseCostAction(
  id: string,
  actualCost: number
) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (session.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const cost = roundMoney(Number(actualCost));
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
