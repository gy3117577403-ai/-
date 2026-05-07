import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BatchContractPrintControls } from "@/components/purchases/batch-contract-print-controls";

type PageProps = {
  searchParams: Promise<{
    ids?: string;
    supplierName?: string;
    contact?: string;
    phone?: string;
  }>;
};

type ContractLine = {
  id: string;
  itemName: string;
  quantity: number;
  amountCents: number;
  unitPrice: number;
};

const CN_NUM = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
const CN_INT_RADICE = ["", "拾", "佰", "仟"];
const CN_INT_UNITS = ["", "万", "亿", "兆"];
const CN_DEC_UNITS = ["角", "分"];

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatCompactDate(date: Date) {
  return formatDate(date).replaceAll("-", "");
}

function createContractNo(date: Date) {
  const seed = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `HT-${formatCompactDate(date)}-${seed}`;
}

function toSafeCents(value: number | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function resolveAmountCents(purchase: {
  actualCost: number | null;
  estimatedCost: number;
}) {
  const actual = toSafeCents(purchase.actualCost);
  if (actual > 0) return actual;
  return toSafeCents(purchase.estimatedCost);
}

function moneyFromCents(cents: number) {
  const safeCents = Number.isFinite(cents) ? cents : 0;
  return `￥${(safeCents / 100).toFixed(2)}`;
}

function numberToChinese(amount: number) {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const cents = Math.round(safeAmount * 100);
  const integer = Math.floor(cents / 100);
  const decimal = cents % 100;

  if (integer === 0 && decimal === 0) return "人民币零元整";

  let intText = "";
  if (integer > 0) {
    const parts = String(integer).split("").reverse();
    let zero = false;

    for (let i = 0; i < parts.length; i += 1) {
      const digit = Number(parts[i]);
      const unitIndex = i % 4;
      const sectionIndex = Math.floor(i / 4);

      if (digit === 0) {
        zero = true;
        if (unitIndex === 0 && sectionIndex > 0 && intText && !intText.startsWith(CN_INT_UNITS[sectionIndex])) {
          intText = CN_INT_UNITS[sectionIndex] + intText;
        }
      } else {
        intText =
          CN_NUM[digit] +
          CN_INT_RADICE[unitIndex] +
          (unitIndex === 0 ? CN_INT_UNITS[sectionIndex] : "") +
          (zero && intText ? "零" : "") +
          intText;
        zero = false;
      }
    }
    intText = intText.replace(/零+/g, "零").replace(/零(万|亿|兆)/g, "$1");
  }

  let decText = "";
  if (decimal > 0) {
    const jiao = Math.floor(decimal / 10);
    const fen = decimal % 10;
    if (jiao > 0) decText += `${CN_NUM[jiao]}${CN_DEC_UNITS[0]}`;
    if (fen > 0) decText += `${jiao === 0 && integer > 0 ? "零" : ""}${CN_NUM[fen]}${CN_DEC_UNITS[1]}`;
  }

  return `人民币${intText ? `${intText}元` : ""}${decText || "整"}`;
}

export default async function BatchContractPrintPage({
  searchParams,
}: PageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const roleOk =
    session.role === "ADMIN" ||
    session.role === "BOSS" ||
    session.role === "PURCHASER";
  if (!roleOk) {
    redirect("/purchases");
  }

  const params = await searchParams;
  const ids = (params.ids ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    notFound();
  }

  const supplierName = params.supplierName?.trim() || "________________";
  const contact = params.contact?.trim() || "________________";
  const phone = params.phone?.trim() || "________________";

  const purchases = await prisma.purchaseRequest.findMany({
    where: {
      id: { in: ids },
    },
  });

  if (purchases.length === 0) {
    notFound();
  }

  const now = new Date();
  const contractNo = createContractNo(now);
  const signDate = formatDate(now);
  const purchaseById = new Map(purchases.map((purchase) => [purchase.id, purchase]));
  const orderedPurchases = ids
    .map((id) => purchaseById.get(id))
    .filter((purchase): purchase is NonNullable<typeof purchase> => Boolean(purchase));

  const lines: ContractLine[] = orderedPurchases.map((purchase) => {
    const quantity = Number.isInteger(purchase.quantity) && purchase.quantity > 0
      ? purchase.quantity
      : 1;
    const amountCents = resolveAmountCents(purchase);

    return {
      id: purchase.id,
      itemName: purchase.itemName,
      quantity,
      amountCents,
      unitPrice: amountCents / 100 / quantity,
    };
  });

  const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const totalAmount = totalCents / 100;

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-black print:min-h-0 print:px-0 print:py-0">
      <BatchContractPrintControls ids={ids} />
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }
          html,
          body {
            background: #fff !important;
            color: #000 !important;
          }
          .no-print {
            display: none !important;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <article className="mx-auto box-border min-h-[297mm] w-[210mm] bg-white p-8 text-black print:min-h-0 print:w-full print:p-0">
        <header className="relative border-b-2 border-black pb-4 text-center">
          <div className="absolute right-0 top-0 text-right text-sm leading-6">
            <p>合同编号：{contractNo}</p>
            <p>签署日期：{signDate}</p>
          </div>
          <h1 className="pt-10 text-2xl font-bold tracking-wide">
            物资采购合同
          </h1>
          <p className="mt-2 text-sm">Purchase Contract</p>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-8 text-sm leading-7">
          <div>
            <p className="font-bold">甲方（需方）：杭州杭连电子有限公司</p>
            <p>地址：浙江省杭州市临平区星桥街道星发街</p>
            <p>电话：0571-86169376</p>
          </div>
          <div>
            <p className="font-bold">乙方（供方）：{supplierName}</p>
            <p>联系人：{contact}</p>
            <p>联系电话：{phone}</p>
          </div>
        </section>

        <p className="mt-6 text-sm leading-7">
          甲乙双方本着平等、自愿、诚实信用原则，就以下物资采购事宜达成本合同，共同遵照执行。
        </p>

        <table className="mt-4 w-full border-collapse border border-black text-sm">
          <thead>
            <tr>
              <th className="w-12 border border-black px-2 py-2 text-center">
                序号
              </th>
              <th className="border border-black px-2 py-2 text-left">
                物资名称
              </th>
              <th className="w-20 border border-black px-2 py-2 text-center">
                数量
              </th>
              <th className="w-28 border border-black px-2 py-2 text-right">
                单价（元）
              </th>
              <th className="w-32 border border-black px-2 py-2 text-right">
                金额（元）
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.id}>
                <td className="border border-black px-2 py-2 text-center">
                  {index + 1}
                </td>
                <td className="border border-black px-2 py-2">
                  {line.itemName}
                </td>
                <td className="border border-black px-2 py-2 text-center tabular-nums">
                  {line.quantity}
                </td>
                <td className="border border-black px-2 py-2 text-right tabular-nums">
                  {line.unitPrice.toFixed(2)}
                </td>
                <td className="border border-black px-2 py-2 text-right tabular-nums">
                  {moneyFromCents(line.amountCents)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={4}
                className="border border-black px-2 py-3 text-right font-bold"
              >
                合计（小写）
              </td>
              <td className="border border-black px-2 py-3 text-right font-bold tabular-nums">
                {moneyFromCents(totalCents)}
              </td>
            </tr>
            <tr>
              <td
                colSpan={5}
                className="border border-black px-2 py-3 text-left font-bold"
              >
                合计（大写）：{numberToChinese(totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-3 text-right text-sm font-semibold">
          （含13%增值税，含运费）
        </p>

        <section className="mt-8 space-y-3 text-sm leading-7 text-justify">
          <p>
            一、质量保证：乙方保证所供物资为全新、未使用且符合国家、行业及甲方使用要求的合格产品；如因质量问题造成甲方损失，乙方应承担修理、更换、退货及赔偿责任。
          </p>
          <p>
            二、交货期限：乙方应按双方确认的交期完成交付。因乙方原因延迟交货的，乙方应及时通知甲方并承担由此产生的合理损失；甲方有权根据实际影响要求乙方采取补救措施。
          </p>
          <p>
            三、验收与异议：甲方收货后按合同约定进行数量、规格及外观验收。如发现短缺、规格不符或明显质量问题，乙方应在接到通知后及时补足、更换或处理。
          </p>
          <p>
            四、付款协议：本合同总价为含税含运费价格。乙方应按甲方要求开具合法有效的13%增值税专用发票；甲方在完成验收并收到合规票据后，按双方约定结算方式付款。
          </p>
          <p>
            五、争议解决：合同履行过程中发生争议，双方应友好协商解决；协商不成的，任一方可向甲方所在地有管辖权的人民法院提起诉讼。
          </p>
        </section>

        <footer className="mt-12 grid grid-cols-2 gap-12 text-sm">
          <div className="min-h-[120px] border-t border-black pt-3">
            <p className="font-bold">甲方（需方）盖章：杭州杭连电子有限公司</p>
            <div className="h-[120px]" />
            <p>授权代表签字：________________</p>
            <p className="mt-2">日期：________________</p>
          </div>
          <div className="min-h-[120px] border-t border-black pt-3">
            <p className="font-bold">乙方（供方）盖章：{supplierName}</p>
            <div className="h-[120px]" />
            <p>授权代表签字：________________</p>
            <p className="mt-2">日期：________________</p>
          </div>
        </footer>
      </article>
    </main>
  );
}
