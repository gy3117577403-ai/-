import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPurchases } from "@/lib/actions/purchase";
import { getSettings } from "@/lib/actions/settings";
import { PurchasesClient } from "./purchases-client";

export default async function PurchasesPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [data, settings] = await Promise.all([
    getPurchases(),
    getSettings(),
  ]);

  return (
    <PurchasesClient
      data={data}
      role={session.role}
      sessionName={session.name}
      enableConfetti={settings.enableConfetti === "true"}
    />
  );
}
