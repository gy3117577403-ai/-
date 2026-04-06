import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getMolds } from "@/lib/actions/mold";
import { MoldsClient } from "./molds-client";

export default async function MoldsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const data = await getMolds();

  return (
    <MoldsClient
      data={data}
      role={session.role}
    />
  );
}
