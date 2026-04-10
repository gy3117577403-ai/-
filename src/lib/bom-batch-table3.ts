/**
 * 表三 BOM 批量导入：固定列索引 + 双层 Map（客户 → 主件规格 → 连接器），无外部 API。
 * 可与 Server Action 共用类型，禁止引入 server-only 依赖。
 */

/** Excel 行（首行可为表头，[6]≠「连接器」的行自动跳过） */
export type Table3SheetRow = (string | number | undefined | null)[];

/** 列索引（0-based），与生产用散表一致 */
export const TABLE3_COL = {
  CUSTOMER_NAME: 0,
  MAIN_SPEC: 3,
  SUB_ITEM_NAME: 6,
  CONNECTOR_MODEL: 7,
  QUANTITY: 9,
} as const;

export type BatchTable3Connector = {
  model: string;
  quantity: number;
};

/** 单组：一个客户下一个主件规格及其连接器列表（已聚合） */
export type BatchTable3Group = {
  customerName: string;
  productSpec: string;
  connectors: BatchTable3Connector[];
};

export type BatchImportPayload = BatchTable3Group[];

function cellStr(v: unknown): string {
  return String(v ?? "").trim();
}

function parseQuantityCell(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    const int = Math.round(v);
    return int < 1 ? 1 : int;
  }
  const s = String(v ?? "")
    .replace(/,/g, "")
    .trim();
  if (s === "") return 1;
  const n = Number(s);
  if (!Number.isFinite(n)) return 1;
  const int = Math.round(n);
  return int < 1 ? 1 : int;
}

/**
 * 仅保留 [6] 严格等于「连接器」的数据行，按 Map<客户, Map<主件规格, Map<型号, 累计用量>>> 聚合。
 * @throws 任意有效连接器行缺主件规格或客户名称时中止
 */
export function aggregateBatchTable3Bom(rows: Table3SheetRow[]): BatchImportPayload {
  /** 客户 → 主件规格 → 连接器型号 → 累计数量 */
  const dataMap = new Map<string, Map<string, Map<string, number>>>();

  for (const row of rows) {
    if (!row || row.length <= TABLE3_COL.QUANTITY) continue;

    if (cellStr(row[TABLE3_COL.SUB_ITEM_NAME]) !== "连接器") continue;

    const customerName = cellStr(row[TABLE3_COL.CUSTOMER_NAME]);
    const productSpec = cellStr(row[TABLE3_COL.MAIN_SPEC]);
    const model = cellStr(row[TABLE3_COL.CONNECTOR_MODEL]);
    const quantity = parseQuantityCell(row[TABLE3_COL.QUANTITY]);

    if (!productSpec) {
      throw new Error("数据行存在主件规格缺失，解析中止");
    }
    if (!customerName) {
      throw new Error("数据行存在客户名称缺失，解析中止");
    }
    if (!model) continue;

    let byCustomer = dataMap.get(customerName);
    if (!byCustomer) {
      byCustomer = new Map();
      dataMap.set(customerName, byCustomer);
    }
    let bySpec = byCustomer.get(productSpec);
    if (!bySpec) {
      bySpec = new Map();
      byCustomer.set(productSpec, bySpec);
    }
    bySpec.set(model, (bySpec.get(model) ?? 0) + quantity);
  }

  const out: BatchImportPayload = [];
  for (const [customerName, bySpec] of dataMap) {
    for (const [productSpec, byModel] of bySpec) {
      const connectors: BatchTable3Connector[] = [];
      for (const [model, quantity] of byModel) {
        connectors.push({ model, quantity });
      }
      if (connectors.length > 0) {
        out.push({ customerName, productSpec, connectors });
      }
    }
  }
  return out;
}

export function normalizeTable3Key(s: string): string {
  return s.replace(/\u3000/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * 从产品 BOM 页导入时：在聚合结果中只保留与当前客户名、主件规格一致的一组。
 */
export function pickGroupForFixedProduct(
  payload: BatchImportPayload,
  customerName: string,
  productCode: string
): BatchTable3Group | null {
  const cn = normalizeTable3Key(customerName);
  const pc = normalizeTable3Key(productCode);
  return (
    payload.find(
      (g) =>
        normalizeTable3Key(g.customerName) === cn &&
        normalizeTable3Key(g.productSpec) === pc
    ) ?? null
  );
}
