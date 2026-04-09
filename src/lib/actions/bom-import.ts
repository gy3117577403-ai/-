"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ParsedBomWhitelistRow } from "@/lib/bom-whitelist";

/**
 * Server Action 入参经序列化后，数字字段偶发为字符串；统一转为 Int。
 * 无法解析或负值：返回 null（调用方应跳过该行，避免脏数据入库）。
 */
function parseBomQuantityStrict(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const int = Math.round(value);
    if (int < 0) return null;
    return int;
  }
  const s = String(value ?? "")
    .replace(/,/g, "")
    .trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const int = Math.round(n);
  if (int < 0) return null;
  return int;
}

function trimOrNull(s: unknown): string | null {
  const t = String(s ?? "").trim();
  return t ? t : null;
}

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

  const bomCreate = connectors
    .map((c) => {
      const connectorModel = String(c.model ?? "").trim();
      const quantity = parseBomQuantityStrict(c.quantity);
      if (!connectorModel || quantity === null) return null;
      return {
        connectorModel,
        quantity,
        partNumber: null as string | null,
        designator: null as string | null,
        description: null as string | null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (!bomCreate.length) {
    throw new Error("连接器用量无法解析为有效数字，或型号为空，请检查表格");
  }

  const productId = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { code: name },
      update: { name },
      create: { code: name, name },
    });

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

  return { total: bomCreate.length, matched: matchCount };
}

/** @alias 与 `processSmartBomImport` 相同，便于语义化引用 */
export const importBOMData = processSmartBomImport;

const CREATE_MANY_CHUNK = 500;

/**
 * 表三白名单导入：必须传入 productId；先清空该产品 BOM 再批量写入（幂等覆写）。
 */
export async function importBomWhitelistForProduct(
  productId: string,
  rows: ParsedBomWhitelistRow[]
) {
  if (!productId?.trim()) throw new Error("请选择产品");
  if (!rows?.length) throw new Error("没有可导入的 BOM 行");

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, code: true },
  });
  if (!product) throw new Error("产品不存在");

  const prepared = rows
    .map((r) => {
      const connectorModel = String(r.connectorModel ?? "").trim();
      const quantity = parseBomQuantityStrict(r.quantity);
      if (!connectorModel || quantity === null) return null;
      return {
        productId,
        partNumber: trimOrNull(r.partNumber),
        designator: trimOrNull(r.designator),
        quantity,
        description: trimOrNull(r.description),
        connectorModel,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (!prepared.length) {
    throw new Error(
      "没有可写入的 BOM 行：请检查「用量/数量」列是否为有效数字，且连接器规格非空"
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.bomItem.deleteMany({ where: { productId } });

    for (let i = 0; i < prepared.length; i += CREATE_MANY_CHUNK) {
      const chunk = prepared.slice(i, i + CREATE_MANY_CHUNK);
      await tx.bomItem.createMany({ data: chunk });
    }
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

  return {
    total: prepared.length,
    matched: matchCount,
    productCode: product.code,
  };
}
