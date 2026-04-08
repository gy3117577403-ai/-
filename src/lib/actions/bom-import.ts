"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

interface ConnectorEntry {
  model: string;
  quantity: number;
}

interface SmartBomPayload {
  customerName: string;
  productCode: string;
  connectors: ConnectorEntry[];
}

function fuzzyMatchJig(
  connectorModel: string,
  inventories: { modelCode: string; matingModel: string | null }[]
): string | null {
  const needle = connectorModel.toLowerCase();
  for (const inv of inventories) {
    if (!inv.matingModel) continue;
    if (inv.matingModel.toLowerCase().includes(needle)) {
      return inv.modelCode;
    }
  }
  return null;
}

/** 智能 BOM 导入（幂等覆写：同规格产品会整表替换连接器明细） */
export async function processSmartBomImport(payload: SmartBomPayload) {
  const { customerName, productCode, connectors } = payload;

  if (!customerName?.trim()) throw new Error("客户名称为空，无法导入");
  if (!productCode?.trim()) throw new Error("产品规格为空，无法导入");
  if (!connectors?.length) throw new Error("未找到连接器数据，无法导入");

  const name = customerName.trim();
  const code = productCode.trim();

  const productId = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { code: name },
      update: { name },
      create: { code: name, name },
    });

    const bomCreate = connectors.map((c) => ({
      connectorModel: c.model,
      quantity: c.quantity,
    }));

    const product = await tx.product.upsert({
      where: { code },
      create: {
        code,
        name: code,
        customerId: customer.id,
        bomItems: { create: bomCreate },
      },
      update: {
        name: code,
        customerId: customer.id,
        bomItems: {
          deleteMany: {},
          create: bomCreate,
        },
      },
    });

    return product.id;
  });

  const inventories = await prisma.jigBaseInventory.findMany({
    select: { modelCode: true, matingModel: true },
  });

  const newBomItems = await prisma.bomItem.findMany({
    where: { productId },
  });

  let matchCount = 0;

  for (const item of newBomItems) {
    const matched = fuzzyMatchJig(item.connectorModel, inventories);
    if (matched) {
      await prisma.bomItem.update({
        where: { id: item.id },
        data: { jigModel: matched },
      });
      matchCount++;
    }
  }

  revalidatePath("/customers");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}/bom`);

  return { total: connectors.length, matched: matchCount };
}

/** @alias 与 `processSmartBomImport` 相同，便于语义化引用 */
export const importBOMData = processSmartBomImport;
