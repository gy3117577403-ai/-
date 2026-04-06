"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createLog } from "@/lib/actions/log";

export async function getOrders() {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        include: { customer: true },
      },
    },
  });
}

export async function getCustomersForSelect() {
  return prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: {
      products: {
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      },
    },
  });
}

interface CreateOrderInput {
  mode: "existing" | "new";
  productId?: string;
  newCustomerName?: string;
  newProductCode?: string;
  plannedQty: number;
  operator: string;
}

export async function createOrder(input: CreateOrderInput) {
  const { mode, plannedQty, operator } = input;

  if (plannedQty < 1) throw new Error("计划产量必须大于 0");
  if (!operator.trim()) throw new Error("请填写操作员");

  let productId: string;
  let status = "READY";
  let shortageInfo: string | null = null;

  if (mode === "new") {
    const { newCustomerName, newProductCode } = input;
    if (!newCustomerName?.trim()) throw new Error("请填写客户名称");
    if (!newProductCode?.trim()) throw new Error("请填写产品规格");

    const custName = newCustomerName.trim();
    const prodCode = newProductCode.trim();

    const customer = await prisma.customer.upsert({
      where: { code: custName },
      update: { name: custName },
      create: { code: custName, name: custName },
    });

    const product = await prisma.product.upsert({
      where: { code: prodCode },
      update: { name: prodCode, customerId: customer.id },
      create: { code: prodCode, name: prodCode, customerId: customer.id },
    });

    productId = product.id;
    status = "NO_BOM";
  } else {
    if (!input.productId) throw new Error("请选择产品");
    productId = input.productId;

    const bomItems = await prisma.bomItem.findMany({
      where: { productId },
    });

    const jigItems = bomItems.filter((b) => b.jigModel);

    if (jigItems.length === 0) {
      status = "NO_BOM";
    } else {
      const shortages: string[] = [];

      for (const item of jigItems) {
        const inv = await prisma.jigBaseInventory.findFirst({
          where: { modelCode: item.jigModel!, category: "JIG" },
        });

        if (!inv) {
          shortages.push(
            `${item.jigModel} — 总仓无此治具 (连接器: ${item.connectorModel})`
          );
          continue;
        }

        if (inv.quantity < item.quantity) {
          shortages.push(
            `${item.jigModel} — 需${item.quantity}，库存${inv.quantity} (连接器: ${item.connectorModel})`
          );
        }
      }

      if (shortages.length > 0) {
        status = "SHORTAGE";
        shortageInfo = shortages.join("; ");
      }
    }
  }

  const orderNo = `PO-${Date.now()}`;

  await prisma.order.create({
    data: {
      orderNo,
      productId,
      plannedQty,
      operator: operator.trim(),
      status,
      shortageInfo,
    },
  });

  revalidatePath("/orders");
  revalidatePath("/customers");

  return { status };
}

export async function deleteOrder(orderId: string) {
  const session = await getSession();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  await prisma.order.delete({ where: { id: orderId } });

  if (session?.name) {
    await createLog(
      session.name,
      "删除",
      "生产开工",
      "删除了开工单: " + order.orderNo
    );
  }

  revalidatePath("/orders");
}

export async function recalculateAllOrders() {
  const pendingOrders = await prisma.order.findMany({
    where: { status: { in: ["SHORTAGE", "NO_BOM"] } },
    include: {
      product: {
        include: { bomItems: true },
      },
    },
  });

  if (pendingOrders.length === 0) return { updated: 0, total: 0 };

  const inventories = await prisma.jigBaseInventory.findMany({
    where: { category: "JIG" },
  });
  const invMap = new Map(inventories.map((i) => [i.modelCode, i.quantity]));

  let updated = 0;

  for (const order of pendingOrders) {
    const jigItems = order.product.bomItems.filter((b) => b.jigModel);

    if (jigItems.length === 0) {
      if (order.status !== "NO_BOM") {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "NO_BOM", shortageInfo: null },
        });
        updated++;
      }
      continue;
    }

    const shortages: string[] = [];

    for (const item of jigItems) {
      const stock = invMap.get(item.jigModel!) ?? -1;

      if (stock < 0) {
        shortages.push(
          `${item.jigModel} — 总仓无此型号 (连接器: ${item.connectorModel})`
        );
      } else if (stock < item.quantity) {
        shortages.push(
          `${item.jigModel} — 需${item.quantity}，库存${stock} (连接器: ${item.connectorModel})`
        );
      }
    }

    const newStatus = shortages.length > 0 ? "SHORTAGE" : "READY";
    const newInfo = shortages.length > 0 ? shortages.join("; ") : null;

    if (order.status !== newStatus || order.shortageInfo !== newInfo) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: newStatus, shortageInfo: newInfo },
      });
      updated++;
    }
  }

  revalidatePath("/orders");
  return { updated, total: pendingOrders.length };
}
