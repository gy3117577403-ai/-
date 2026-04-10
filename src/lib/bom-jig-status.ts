/**
 * BOM 行「匹配治具」状态：客户页标色、工单齐套、智能匹配等共用语义。
 */

export const JIG_NONE_UI_LABEL = "未匹配（无需治具）";
/** 显式豁免：不占库存、不算缺料 */
export const JIG_MODEL_NO_NEED = "无需治具";
/** 显式未匹配：算缺料 */
export const JIG_MODEL_UNMATCHED = "未匹配";

/** 是否仍缺「治具指派」（客户页标红 / 工单 SHORTAGE 缺匹配前缀） */
export function bomRowNeedsJigAssignment(
  jigModel: string | null | undefined
): boolean {
  const t = jigModel?.trim() ?? "";
  if (t === "") return true;
  if (t === JIG_MODEL_UNMATCHED) return true;
  return false;
}

export function bomRowIsExplicitNoJig(
  jigModel: string | null | undefined
): boolean {
  return jigModel?.trim() === JIG_MODEL_NO_NEED;
}

/**
 * Creatable 输入 → 入库 jigModel。
 * - 空：未填 → null（缺料）
 * - 菜单「未匹配（无需治具）」或「无需治具」→ 显式豁免字符串
 * - 其余原样（含「未匹配」、新型号）
 */
export function normalizeJigModelInputForStorage(raw: string): string | null {
  const t = raw.replace(/\u3000/g, " ").trim();
  if (t === "") return null;
  if (t === JIG_NONE_UI_LABEL || t === JIG_MODEL_NO_NEED) {
    return JIG_MODEL_NO_NEED;
  }
  return t;
}
