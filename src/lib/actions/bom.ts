"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createLog } from "@/lib/actions/log";
import {
  evaluateOrderFulfillment,
  loadJigInventoryMap,
} from "@/lib/actions/order";
import { matchConnectorToJigModel } from "@/lib/bom-match";
import { JIG_MODEL_NO_NEED, JIG_MODEL_UNMATCHED } from "@/lib/bom-jig-status";

/** 新型号写入 BOM 时，总仓无记录则 quantity=0 反向建档（仅真实治具型号） */
async function ensureJigBaseInventoryMirror(
  jigModel: string | null | undefined,
  connectorModel: string
): Promise<void> {
  const target = jigModel?.trim() ?? "";
  if (!target || target === JIG_MODEL_UNMATCHED || target === JIG_MODEL_NO_NEED) {
    return;
  }

  try {
    const existing = await prisma.jigBaseInventory.findUnique({
      where: { modelCode: target },
    });
    if (existing) return;

    await prisma.jigBaseInventory.create({
      data: {
        modelCode: target,
        matingModel: connectorModel.trim() || null,
        quantity: 0,
        category: "JIG",
      },
    });

    revalidatePath("/jig-inventory");
  } catch (error) {
    console.error(
      "[ensureJigBaseInventoryMirror] 反向建档失败:",
      error instanceof Error ? error.stack ?? error.message : error
    );
    throw error;
  }
}

const BOM_ITEM_NEEDS_MATCH_WHERE = {
  OR: [
    { jigModel: null },
    { jigModel: "" },
    { jigModel: JIG_MODEL_UNMATCHED },
  ],
};

export async function getBomItems(productId: string) {
  return prisma.bomItem.findMany({
    where: { productId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getProductWithCustomer(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: { customer: true },
  });
}

export async function getAvailableJigModels() {
  const rows = await prisma.jigBaseInventory.findMany({
    where: { category: "JIG" },
    select: { modelCode: true },
    orderBy: { modelCode: "asc" },
  });
  return rows.map((r) => r.modelCode);
}

export async function updateBomItemJig(
  bomItemId: string,
  jigModel: string | null,
  productId: string,
  applyToAllIdentical = false
): Promise<{ updated: number }> {
  const row = await prisma.bomItem.findUnique({
    where: { id: bomItemId },
    select: { id: true, productId: true, connectorModel: true },
  });
  if (!row) {
    throw new Error("BOM 行不存在");
  }
  if (row.productId !== productId) {
    throw new Error("产品不一致，拒绝操作");
  }

  if (applyToAllIdentical) {
    const targetConnector = row.connectorModel;

    const affectedProducts = await prisma.bomItem.findMany({
      where: { connectorModel: targetConnector },
      select: { productId: true },
      distinct: ["productId"],
    });
    const uniqueProductIds = [
      ...new Set(affectedProducts.map((r) => r.productId)),
    ];

    const result = await prisma.bomItem.updateMany({
      where: { connectorModel: targetConnector },
      data: { jigModel },
    });

    await ensureJigBaseInventoryMirror(jigModel, targetConnector);

    revalidatePath("/customers");
    revalidatePath("/orders");
    revalidatePath("/dashboard");
    for (const pid of uniqueProductIds) {
      revalidatePath(`/products/${pid}/bom`);
    }
    return { updated: result.count };
  }

  await prisma.bomItem.update({
    where: { id: bomItemId },
    data: { jigModel },
  });
  await ensureJigBaseInventoryMirror(jigModel, row.connectorModel);

  revalidatePath(`/products/${productId}/bom`);
  return { updated: 1 };
}

export async function autoMatchBomJigs(productId: string) {
  const unmatched = await prisma.bomItem.findMany({
    where: {
      productId,
      ...BOM_ITEM_NEEDS_MATCH_WHERE,
    },
  });

  if (unmatched.length === 0) {
    return { matched: 0, total: 0 };
  }

  const inventories = await prisma.jigBaseInventory.findMany({
    where: { category: "JIG" },
    select: { modelCode: true, matingModel: true },
  });

  let matched = 0;

  for (const item of unmatched) {
    const jig = matchConnectorToJigModel(item.connectorModel, inventories);
    if (jig) {
      await prisma.bomItem.update({
        where: { id: item.id },
        data: { jigModel: jig },
      });
      matched++;
    }
  }

  revalidatePath(`/products/${productId}/bom`);
  return { matched, total: unmatched.length };
}

/**
 * 全库 BOM 未匹配行一键按总仓对插规则写入 jigModel；写 OperationLog；对涉及产品的 SHORTAGE 工单按齐套规则重算。
 */
export async function globalSmartMatchFixturesAction(): Promise<{
  updatedItems: number;
  affectedProducts: number;
  ordersReconciled: number;
}> {
  const session = await getSession();
  if (!session) {
    throw new Error("未登录");
  }

  try {
    const inventories = await prisma.jigBaseInventory.findMany({
      where: { category: "JIG" },
      select: { modelCode: true, matingModel: true },
    });

    const unmatched = await prisma.bomItem.findMany({
      where: {
        ...BOM_ITEM_NEEDS_MATCH_WHERE,
      },
      select: { id: true, productId: true, connectorModel: true },
    });

    const affectedProductIds = new Set<string>();
    let updatedItems = 0;

    for (const item of unmatched) {
      const jig = matchConnectorToJigModel(item.connectorModel, inventories);
      if (!jig) continue;

      await prisma.bomItem.update({
        where: { id: item.id },
        data: { jigModel: jig },
      });
      affectedProductIds.add(item.productId);
      updatedItems++;
    }

    const invMap = await loadJigInventoryMap();
    const productIdList = [...affectedProductIds];

    const shortageOrders =
      productIdList.length > 0
        ? await prisma.order.findMany({
            where: {
              productId: { in: productIdList },
              status: "SHORTAGE",
            },
            select: { id: true, productId: true, status: true, shortageInfo: true },
          })
        : [];

    let ordersReconciled = 0;
    for (const order of shortageOrders) {
      const next = await evaluateOrderFulfillment(order.productId, invMap);
      if (
        order.status !== next.status ||
        order.shortageInfo !== next.shortageInfo
      ) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: next.status,
            shortageInfo: next.shortageInfo,
          },
        });
        ordersReconciled++;
      }
    }

    await createLog(
      session.name,
      "全局匹配",
      "BOM",
      `一键全局智能匹配治具：更新 BOM 明细 ${updatedItems} 条，涉及产品 ${affectedProductIds.size} 个；同步校正 SHORTAGE 工单 ${ordersReconciled} 条。`
    );

    revalidatePath("/customers");
    revalidatePath("/orders");
    revalidatePath("/dashboard");
    for (const pid of productIdList) {
      revalidatePath(`/products/${pid}/bom`);
    }

    return {
      updatedItems,
      affectedProducts: affectedProductIds.size,
      ordersReconciled,
    };
  } catch (error) {
    console.error(
      "[globalSmartMatchFixturesAction] 执行失败:",
      error instanceof Error ? error.stack ?? error.message : error
    );
    throw error instanceof Error ? error : new Error("全局匹配失败");
  }
}
