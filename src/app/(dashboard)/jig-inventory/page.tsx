import { getJigBaseInventories } from "@/lib/actions/jig-inventory";
import { JigInventoryClient } from "./jig-inventory-client";

export default async function JigInventoryPage() {
  const data = await getJigBaseInventories();
  return <JigInventoryClient data={data} />;
}
