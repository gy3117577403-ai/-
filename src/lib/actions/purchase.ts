"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { PurchaseStatus, ItemCategory } from "@prisma/client";
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

export async function deletePurchaseRequest(id: string) {
  const session = await getSession();
  if (!session) throw new Error("未登录");

  const row = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!row) throw new Error("请购单不存在");

  // 若为管理员，可以无视状态强制删除
  if (session.role === "ADMIN") {
    await prisma.purchaseRequest.delete({ where: { id } });
    revalidatePath("/purchases");
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
