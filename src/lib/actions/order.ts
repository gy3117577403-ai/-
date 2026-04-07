"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createLog } from "@/lib/actions/log";
import { SHORTAGE_UNMATCHED_JIG_PREFIX } from "@/lib/order-constants";

async function loadJigInventoryMap(): Promise<Map<string, number>> {
  const inventories = await prisma.jigBaseInventory.findMany({
    where: { category: "JIG" },
  });
  return new Map(inventories.map((i) => [i.modelCode, i.quantity]));
}

/**
 * 深度 BOM 齐套核算：先校验每条 BOM 是否已关联治具型号，再校验总仓库存。
 */
export async function evaluateOrderFulfillment(
  productId: string,
  invMap: Map<string, number>
): Promise<{
  status: "READY" | "SHORTAGE" | "NO_BOM";
  shortageInfo: string | null;
}> {
  const bomItems = await prisma.bomItem.findMany({
    where: { productId },
    orderBy: { createdAt: "asc" },
  });

  if (bomItems.length === 0) {
    return { status: "NO_BOM", shortageInfo: null };
  }

  const unmatched = bomItems.filter((b) => !b.jigModel?.trim());
  if (unmatched.length > 0) {
    const names = unmatched.map((b) => b.connectorModel).join(", ");
    return {
      status: "SHORTAGE",
      shortageInfo: `${SHORTAGE_UNMATCHED_JIG_PREFIX} ${names}`,
    };
  }

  const shortages: string[] = [];
  for (const item of bomItems) {
    const jig = item.jigModel!.trim();
    const stock = invMap.get(jig) ?? -1;
    if (stock < 0) {
      shortages.push(
        `${jig} — 总仓无此治具 (连接器: ${item.connectorModel})`
      );
    } else if (stock < item.quantity) {
      shortages.push(
        `${jig} — 需${item.quantity}，库存${stock} (连接器: ${item.connectorModel})`
      );
    }
  }

  if (shortages.length > 0) {
    return { status: "SHORTAGE", shortageInfo: shortages.join("; ") };
  }

  return { status: "READY", shortageInfo: null };
}

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
  let status: "READY" | "SHORTAGE" | "NO_BOM" = "READY";
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

    const invMap = await loadJigInventoryMap();
    const result = await evaluateOrderFulfillment(productId, invMap);
    status = result.status;
    shortageInfo = result.shortageInfo;
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
  const allOrders = await prisma.order.findMany({
    select: { id: true, productId: true, status: true, shortageInfo: true },
  });

  if (allOrders.length === 0) return { updated: 0, total: 0 };

  const invMap = await loadJigInventoryMap();
  let updated = 0;

  for (const order of allOrders) {
    const { status: newStatus, shortageInfo: newInfo } =
      await evaluateOrderFulfillment(order.productId, invMap);

    if (order.status !== newStatus || order.shortageInfo !== newInfo) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: newStatus, shortageInfo: newInfo },
      });
      updated++;
    }
  }

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { updated, total: allOrders.length };
}
