import { getCustomersWithProducts } from "@/lib/actions/customer";
import { CustomersClient } from "./customers-client";

export default async function CustomersPage() {
  const customers = await getCustomersWithProducts();
  return <CustomersClient data={customers} />;
}
