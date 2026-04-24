import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AutoPrint } from "@/components/purchases/auto-print";
import { ContractPrintView } from "@/components/purchases/contract-print-view";

const LARGE_AMOUNT = 500;

export default async function ContractPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const { id } = await params;
  const purchase = await prisma.purchaseRequest.findUnique({
    where: { id },
  });
  if (!purchase) {
    notFound();
  }

  const costOk =
    purchase.actualCost != null &&
    Number.isFinite(purchase.actualCost) &&
    purchase.actualCost >= LARGE_AMOUNT;
  const statusOk =
    purchase.status === "ORDERED" || purchase.status === "RECEIVED";

  if (!costOk || !statusOk) {
    redirect("/purchases");
  }

  return (
    <main className="print-contract-shell box-border min-h-screen bg-white px-4 py-6 text-black print:min-h-0 print:px-0 print:py-0">
      <AutoPrint />
      <ContractPrintView purchase={purchase} />
    </main>
  );
}
