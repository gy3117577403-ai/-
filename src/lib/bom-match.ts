export type JigInvRow = { modelCode: string; matingModel: string | null };

/** 与单产品「智能匹配」相同的规则：对插型号包含连接器规格（不区分大小写） */
export function matchConnectorToJigModel(
  connectorModel: string,
  inventories: JigInvRow[]
): string | null {
  const needle = connectorModel.toLowerCase();
  const hit = inventories.find(
    (inv) => inv.matingModel && inv.matingModel.toLowerCase().includes(needle)
  );
  return hit?.modelCode ?? null;
}
