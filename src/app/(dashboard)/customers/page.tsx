import { getCustomersWithProducts } from "@/lib/actions/customer";
import { getSession } from "@/lib/auth";
import { CustomersClient } from "./customers-client";

export default async function CustomersPage() {
  const [customers, session] = await Promise.all([
    getCustomersWithProducts(),
    getSession(),
  ]);
  const isAdmin = session?.role === "ADMIN";
  return <CustomersClient data={customers} isAdmin={isAdmin} />;
}
