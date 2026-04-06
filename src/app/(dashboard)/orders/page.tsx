import { getOrders, getCustomersForSelect } from "@/lib/actions/order";
import { OrdersClient } from "./orders-client";

export default async function OrdersPage() {
  const [orders, customers] = await Promise.all([
    getOrders(),
    getCustomersForSelect(),
  ]);

  return <OrdersClient orders={orders} customers={customers} />;
}
