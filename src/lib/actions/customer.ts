"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { JIG_MODEL_UNMATCHED } from "@/lib/bom-jig-status";

export async function getCustomersWithProducts() {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        products: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { bomItems: true } } },
        },
      },
    });

    const productIds = customers.flatMap((c) => c.products.map((p) => p.id));
    if (productIds.length === 0) {
      return customers.map((c) => ({
        ...c,
        products: c.products.map((p) => ({
          ...p,
          bomUnmatchedCount: 0,
          bomUnmatchedConnectors: [] as string[],
        })),
      }));
    }

    const unmatchedItems = await prisma.bomItem.findMany({
      where: {
        productId: { in: productIds },
        OR: [
          { jigModel: null },
          { jigModel: "" },
          { jigModel: JIG_MODEL_UNMATCHED },
        ],
      },
      select: { productId: true, connectorModel: true },
      orderBy: { createdAt: "asc" },
    });

    const byProduct = new Map<string, string[]>();
    for (const row of unmatchedItems) {
      const list = byProduct.get(row.productId) ?? [];
      list.push(row.connectorModel);
      byProduct.set(row.productId, list);
    }

    return customers.map((c) => ({
      ...c,
      products: c.products.map((p) => {
        const conns = byProduct.get(p.id) ?? [];
        return {
          ...p,
          bomUnmatchedCount: conns.length,
          bomUnmatchedConnectors: conns,
        };
      }),
    }));
  } catch (error) {
    console.error(
      "[getCustomersWithProducts] 数据库查询失败:",
      error instanceof Error ? error.stack ?? error.message : error
    );
    return [];
  }
}

export async function createCustomer(data: { code: string; name: string }) {
  await prisma.customer.create({ data });
  revalidatePath("/customers");
}
