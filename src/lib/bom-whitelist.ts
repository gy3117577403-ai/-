/**
 * 表三 BOM 白名单：仅允许将下列 CSV/Excel 表头映射到结构化字段，其余列一律丢弃。
 * 客户端与服务端共用，禁止在此文件使用 server-only 依赖。
 */

export type BomWhitelistField =
  | "partNumber"
  | "designator"
  | "quantity"
  | "description"
  | "connectorModel"
  /** 用于按行筛选归属主件（与 Product.code 对齐），不落库 */
  | "mainSpec"
  /** 用于筛选「连接器」行，不落库 */
  | "itemName"
  /** 可选校验，不落库 */
  | "customerName";

/** 中文（及常见别名）表头 → 内部字段名 */
export const BOM_HEADER_MAP: Record<string, BomWhitelistField> = {
  物料编号: "partNumber",
  物料编码: "partNumber",
  零件号: "partNumber",
  料号: "partNumber",
  用量: "quantity",
  组成量: "quantity",
  数量: "quantity",
  需求数量: "quantity",
  位号: "designator",
  器件位号: "designator",
  参考位号: "designator",
  描述: "description",
  说明: "description",
  备注: "description",
  品名: "itemName",
  "品名/描述": "itemName",
  规格: "connectorModel",
  型号: "connectorModel",
  子件规格: "connectorModel",
  连接器规格: "connectorModel",
  主件规格: "mainSpec",
  产品规格: "mainSpec",
  机种: "mainSpec",
  機種: "mainSpec",
  客户: "customerName",
  客户名称: "customerName",
  客戶: "customerName",
};

export type SheetRow = (string | number | undefined | null)[];

export type ParsedBomWhitelistRow = {
  partNumber?: string;
  designator?: string;
  quantity: number;
  description?: string;
  connectorModel: string;
};

export function normalizeHeaderCell(s: string): string {
  return String(s ?? "")
    .replace(/\u3000/g, " ")
    .trim()
    .replace(/\s+/g, "");
}

/** 表头行：取前 scanRows 行中，命中白名单列数最多的一行 */
export function findBomWhitelistHeaderRow(
  rows: SheetRow[],
  scanRows = 40
): { rowIndex: number; colMap: Partial<Record<BomWhitelistField, number>> } | null {
  let bestIdx = -1;
  let bestScore = 0;
  let bestMap: Partial<Record<BomWhitelistField, number>> = {};
  const limit = Math.min(rows.length, scanRows);

  for (let r = 0; r < limit; r++) {
    const row = rows[r] ?? [];
    const colMap: Partial<Record<BomWhitelistField, number>> = {};
    for (let c = 0; c < row.length; c++) {
      const n = normalizeHeaderCell(String(row[c] ?? ""));
      if (!n) continue;
      for (const [label, field] of Object.entries(BOM_HEADER_MAP)) {
        if (normalizeHeaderCell(label) === n) {
          if (colMap[field] === undefined) colMap[field] = c;
          break;
        }
      }
    }
    const score = Object.keys(colMap).length;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = r;
      bestMap = colMap;
    }
  }

  if (bestIdx < 0 || bestScore < 2) return null;
  return { rowIndex: bestIdx, colMap: bestMap };
}

function cellAt(row: SheetRow, idx: number | undefined): string {
  if (idx === undefined) return "";
  return String(row[idx] ?? "").trim();
}

function parseQty(v: string): number {
  const n = Number(String(v).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.max(1, Math.round(n));
}

/** 合并行时用量求和：兼容 Excel 数字格为 number、序列化后为 string */
function coerceQuantityForMerge(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    const int = Math.round(value);
    return int < 1 ? 1 : int;
  }
  return parseQty(String(value ?? ""));
}

/**
 * 从整张表解析白名单行；可选只保留 mainSpec 与当前产品 code 一致的行（批量散表）。
 * 品名列存在时，仅保留品名含「连接器」的行（与旧逻辑一致）。
 */
export function parseWhitelistBomRows(
  rows: SheetRow[],
  options: {
    /** 当前导入归属的产品规格编码，用于过滤「主件规格」列 */
    productCode: string;
    /** 若表中有主件规格列，是否只导入等于 productCode 的行 */
    filterByMainSpec: boolean;
  }
): { items: ParsedBomWhitelistRow[]; skippedRows: number; headerRowIndex: number } {
  const found = findBomWhitelistHeaderRow(rows);
  if (!found) {
    return { items: [], skippedRows: 0, headerRowIndex: -1 };
  }

  const { rowIndex: headerIdx, colMap } = found;
  const code = options.productCode.trim();
  const hasMainSpec = colMap.mainSpec !== undefined;
  const hasItemName = colMap.itemName !== undefined;
  const hasConnectorCol = colMap.connectorModel !== undefined;

  if (!hasConnectorCol) {
    return { items: [], skippedRows: 0, headerRowIndex: headerIdx };
  }

  const raw: ParsedBomWhitelistRow[] = [];
  let skippedRows = 0;

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => !String(c ?? "").trim())) continue;

    if (options.filterByMainSpec && hasMainSpec) {
      const main = cellAt(row, colMap.mainSpec);
      if (main && normalizeHeaderCell(main) !== normalizeHeaderCell(code)) {
        skippedRows++;
        continue;
      }
    }

    if (hasItemName) {
      const item = cellAt(row, colMap.itemName);
      if (!item || !/连接器|連接器|connector/i.test(item)) {
        skippedRows++;
        continue;
      }
    }

    const connectorModel = cellAt(row, colMap.connectorModel);
    if (!connectorModel) {
      skippedRows++;
      continue;
    }

    const partNumber = cellAt(row, colMap.partNumber) || undefined;
    const designator = cellAt(row, colMap.designator) || undefined;
    let description = cellAt(row, colMap.description) || undefined;
    if (!description && hasItemName) {
      description = cellAt(row, colMap.itemName) || undefined;
    }

    const qtyCell = colMap.quantity !== undefined ? row[colMap.quantity] : undefined;
    const quantity =
      colMap.quantity !== undefined
        ? coerceQuantityForMerge(qtyCell)
        : 1;

    raw.push({
      partNumber,
      designator,
      quantity,
      description,
      connectorModel,
    });
  }

  const items = consolidateBomRows(raw);
  return { items, skippedRows, headerRowIndex: headerIdx };
}

/** 相同主键合并用量（主件规格散表重复行） */
export function consolidateBomRows(
  rows: ParsedBomWhitelistRow[]
): ParsedBomWhitelistRow[] {
  const map = new Map<
    string,
    ParsedBomWhitelistRow
  >();
  for (const row of rows) {
    const key = [
      row.connectorModel,
      row.partNumber ?? "",
      row.designator ?? "",
    ].join("\t");
    const prev = map.get(key);
    if (prev) {
      prev.quantity =
        coerceQuantityForMerge(prev.quantity) +
        coerceQuantityForMerge(row.quantity);
      if (!prev.description && row.description) prev.description = row.description;
    } else {
      map.set(key, { ...row });
    }
  }
  return [...map.values()];
}
