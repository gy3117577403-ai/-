import type { PurchaseRequest } from "@prisma/client";

type Props = {
  purchase: PurchaseRequest;
};

/**
 * A4 采购合同打印视图（独立路由下使用：无 body visibility 截断，避免空白 PDF）
 */
export function ContractPrintView({ purchase }: Props) {
  const qty = Math.max(1, purchase.quantity);
  const total =
    purchase.actualCost != null && Number.isFinite(purchase.actualCost)
      ? purchase.actualCost
      : 0;
  const unitPrice = total / qty;

  return (
    <>
      <style>{`
        @media print {
          @page {
            margin: 10mm;
          }
          html,
          body {
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="contract-print-root mx-auto box-border w-full max-w-[210mm] bg-white p-8 text-black print:p-0">
        <header className="border-b-2 border-black pb-3 text-center">
          <h1 className="text-xl font-bold tracking-wide">
            杭州杭连电子有限公司
          </h1>
          <p className="mt-1 text-sm leading-relaxed">
            TEL：0571-86169376 &nbsp;&nbsp; FAX：0571-86163716
          </p>
          <p className="mt-2 text-left text-sm leading-6">
            地址：浙江省杭州市临平区星桥街道星发街17号星罗大楼2号楼3楼
          </p>
          <p className="mt-1 text-left text-sm leading-6">
            开户行：浙江泰隆商业银行杭州临平支行 &nbsp; 账号：33020020201000004191
            <br />
            统一社会信用代码（税号）：91330110MA2H1PDD95
          </p>
        </header>

        <h2 className="mt-6 text-center text-lg font-bold">
          物资采购合同（打印稿）
        </h2>

        <p className="mt-4 text-sm leading-7">
          <span className="font-semibold">合同编号：</span>
          {purchase.contractNo?.trim() || "—"}
          &nbsp;&nbsp;
          <span className="font-semibold">请购单号：</span>
          {purchase.requestNo}
        </p>

        <table className="mt-4 w-full border-collapse border border-black text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black px-2 py-2">品名</th>
              <th className="border border-black px-2 py-2">数量</th>
              <th className="border border-black px-2 py-2">单价（元）</th>
              <th className="border border-black px-2 py-2">金额（元）</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black px-2 py-2 font-medium">
                {purchase.itemName}
              </td>
              <td className="border border-black px-2 py-2 text-center tabular-nums">
                {qty}
              </td>
              <td className="border border-black px-2 py-2 text-right tabular-nums">
                {unitPrice.toFixed(2)}
              </td>
              <td className="border border-black px-2 py-2 text-right font-semibold tabular-nums">
                {total.toFixed(2)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={3}
                className="border border-black px-2 py-2 text-right font-semibold"
              >
                合计（人民币）
              </td>
              <td className="border border-black px-2 py-2 text-right font-bold tabular-nums">
                <div className="flex flex-col items-end">
                  <span>¥{total.toFixed(2)}</span>
                  <span className="text-[11px] font-medium text-slate-700">
                    (含13%增值税，含运费)
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>

        <section className="mt-6 space-y-3 text-sm leading-7 text-justify">
          <p>
            <span className="font-semibold">一、质量保证：</span>
            乙方所供物资须为全新、未使用之合格品，符合国家及行业相关质量标准，并与本合同约定规格、型号一致；随货应提供必要合格证或检测报告（如有）。
          </p>
          <p>
            <span className="font-semibold">二、验收与异议：</span>
            甲方在收货后合理期限内完成验收；如发现数量短缺、规格不符或质量缺陷，乙方须在接到通知后及时补货、换货或退货处理，并承担由此产生的合理费用。
          </p>
          <p>
            <span className="font-semibold">三、质保与售后：</span>
            在质保期内因产品质量问题导致的损失，由乙方依法承担修理、更换、退货及赔偿责任；乙方应提供必要的技术支持与售后服务。
          </p>
          <p>
            <span className="font-semibold">四、违约责任：</span>
            任何一方未按约定履行义务的，应承担继续履行、采取补救措施或赔偿损失等违约责任；乙方迟延交货或交付不符合约定的，甲方有权要求乙方支付违约金并赔偿甲方因此遭受的直接经济损失（违约金及赔偿总额以法律规定及双方另行约定为限）。
          </p>
          <p>
            <span className="font-semibold">五、运输方式：</span>
            由供方承担（含运费）。
          </p>
          <p>
            <span className="font-semibold">六、付款方式：</span>
            供方开具13%增值税专用发票（含税）。
          </p>
        </section>

        <footer className="mt-10 flex justify-between text-sm print:mt-12">
          <div>
            <p className="font-semibold">甲方（盖章）：杭州杭连电子有限公司</p>
            <p className="mt-8">代表签字：_______________</p>
            <p className="mt-2">日期：_______________</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">乙方（盖章）：_____________________</p>
            <p className="mt-8">代表签字：_______________</p>
            <p className="mt-2">日期：_______________</p>
          </div>
        </footer>
      </div>
    </>
  );
}
