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

export type ImportBomWhitelistInput = {
  productId: string;
  rows: ParsedBomWhitelistRow[];
};

/**
 * 表三白名单导入：单对象入参避免 Server Action 多参数序列化丢字段；
 * createMany 前对每一行显式注入数据库校验后的 productId。
 */
export async function importBomWhitelistForProduct(
  input: ImportBomWhitelistInput
) {
  const rawId = String(input?.productId ?? "").trim();
  if (!rawId) throw new Error("请选择产品");

  const rows = Array.isArray(input?.rows) ? input.rows : [];
  if (!rows.length) throw new Error("没有可导入的 BOM 行");

  const product = await prisma.product.findUnique({
    where: { id: rawId },
    select: { id: true, code: true },
  });
  if (!product) throw new Error("产品不存在");

  /** 一律使用库中 id，避免入参与库不一致；后续写入必须带此字段 */
  const targetProductId = product.id;

  const prepared = rows
    .map((r) => {
      const connectorModel = String(r.connectorModel ?? "").trim();
      const quantity = parseBomQuantityStrict(r.quantity);
      if (!connectorModel || quantity === null) return null;
      return {
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

  const dataToInsert = prepared.map((row) => ({
    productId: targetProductId,
    partNumber: row.partNumber,
    designator: row.designator,
    quantity: row.quantity,
    description: row.description,
    connectorModel: row.connectorModel,
  }));

  await prisma.$transaction(async (tx) => {
    await tx.bomItem.deleteMany({ where: { productId: targetProductId } });

    for (let i = 0; i < dataToInsert.length; i += CREATE_MANY_CHUNK) {
      const chunk = dataToInsert.slice(i, i + CREATE_MANY_CHUNK);
      await tx.bomItem.createMany({ data: chunk });
    }
  });

  const inventories = await prisma.jigBaseInventory.findMany({
    select: { modelCode: true, matingModel: true },
  });

  const newBomItems = await prisma.bomItem.findMany({
    where: { productId: targetProductId },
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
  revalidatePath(`/products/${targetProductId}/bom`);

  return {
    total: dataToInsert.length,
    matched: matchCount,
    productCode: product.code,
  };
}
