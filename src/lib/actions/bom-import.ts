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

export async function processSmartBomImport(payload: SmartBomPayload) {
  const { customerName, productCode, connectors } = payload;

  if (!customerName?.trim()) throw new Error("客户名称为空，无法导入");
  if (!productCode?.trim()) throw new Error("产品规格为空，无法导入");
  if (!connectors?.length) throw new Error("未找到连接器数据，无法导入");

  const name = customerName.trim();
  const code = productCode.trim();

  let productId: string;

  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { code: name },
      update: { name },
      create: { code: name, name },
    });

    const product = await tx.product.upsert({
      where: { code },
      update: { name: code, customerId: customer.id },
      create: { code, name: code, customerId: customer.id },
    });

    productId = product.id;

    await tx.bomItem.deleteMany({ where: { productId: product.id } });

    await tx.bomItem.createMany({
      data: connectors.map((c) => ({
        productId: product.id,
        connectorModel: c.model,
        quantity: c.quantity,
      })),
    });
  });

  const inventories = await prisma.jigBaseInventory.findMany({
    select: { modelCode: true, matingModel: true },
  });

  const newBomItems = await prisma.bomItem.findMany({
    where: { productId: productId! },
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

  return { total: connectors.length, matched: matchCount };
}
