import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AutoPrint } from "@/components/purchases/auto-print";

type PageProps = {
  searchParams: Promise<{
    ids?: string;
    supplierName?: string;
    contact?: string;
    phone?: string;
  }>;
};

function money(value: number) {
  return `￥${value.toFixed(2)}`;
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

  const purchaseById = new Map(purchases.map((purchase) => [purchase.id, purchase]));
  const orderedPurchases = ids
    .map((id) => purchaseById.get(id))
    .filter((purchase): purchase is NonNullable<typeof purchase> => Boolean(purchase));
  const total = orderedPurchases.reduce(
    (sum, purchase) => sum + purchase.estimatedCost,
    0
  );

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-black print:min-h-0 print:px-0 print:py-0">
      <AutoPrint />
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
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <article className="mx-auto box-border w-full max-w-[210mm] bg-white p-8 text-black print:p-0">
        <header className="border-b-2 border-black pb-4 text-center">
          <h1 className="text-2xl font-bold tracking-wide">物资采购合并合同</h1>
          <p className="mt-3 text-sm">合同生成日期：____年____月____日</p>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-8 text-sm leading-7">
          <div>
            <p className="font-bold">甲方：杭州杭连电子有限公司</p>
            <p>地址：浙江省杭州市临平区星桥街道星发街</p>
            <p>电话：0571-86169376</p>
          </div>
          <div>
            <p className="font-bold">乙方：{supplierName}</p>
            <p>联系人：{contact}</p>
            <p>联系电话：{phone}</p>
          </div>
        </section>

        <table className="mt-8 w-full border-collapse border border-black text-sm">
          <thead>
            <tr>
              <th className="w-14 border border-black px-2 py-2 text-center">
                序号
              </th>
              <th className="border border-black px-2 py-2 text-left">
                物资名称
              </th>
              <th className="w-24 border border-black px-2 py-2 text-center">
                数量
              </th>
              <th className="w-36 border border-black px-2 py-2 text-right">
                预估金额
              </th>
            </tr>
          </thead>
          <tbody>
            {orderedPurchases.map((purchase, index) => (
              <tr key={purchase.id}>
                <td className="border border-black px-2 py-2 text-center">
                  {index + 1}
                </td>
                <td className="border border-black px-2 py-2">
                  {purchase.itemName}
                </td>
                <td className="border border-black px-2 py-2 text-center tabular-nums">
                  {purchase.quantity}
                </td>
                <td className="border border-black px-2 py-2 text-right tabular-nums">
                  {money(purchase.estimatedCost)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={3}
                className="border border-black px-2 py-3 text-right font-bold"
              >
                合计（人民币）
              </td>
              <td className="border border-black px-2 py-3 text-right font-bold tabular-nums">
                {money(total)}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-4 text-right text-sm font-semibold">
          （含13%增值税，含运费）
        </p>

        <section className="mt-8 space-y-3 text-sm leading-7 text-justify">
          <p>
            一、乙方应按本合同所列物资名称、数量、质量要求向甲方供货，并保证所供物资为合格产品。
          </p>
          <p>
            二、甲方按双方约定完成验收；如发现数量、规格或质量问题，乙方应及时补足、更换或处理。
          </p>
          <p>
            三、运输费用由乙方承担，乙方应开具符合约定的13%增值税专用发票。
          </p>
        </section>

        <footer className="mt-14 grid grid-cols-2 gap-12 text-sm leading-8">
          <div>
            <p className="font-bold">甲方（盖章）：杭州杭连电子有限公司</p>
            <p className="mt-8">代表签字：________________</p>
            <p>日期：________________</p>
          </div>
          <div>
            <p className="font-bold">乙方（盖章）：{supplierName}</p>
            <p className="mt-8">代表签字：________________</p>
            <p>日期：________________</p>
          </div>
        </footer>
      </article>
    </main>
  );
}
