import { notFound } from "next/navigation";
import {
  getBomItems,
  getProductWithCustomer,
  getAvailableJigModels,
} from "@/lib/actions/bom";
import { getSession } from "@/lib/auth";
import { BomClient } from "./bom-client";

export default async function BomPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;

  const [product, bomItems, jigModels, session] = await Promise.all([
    getProductWithCustomer(productId),
    getBomItems(productId),
    getAvailableJigModels(),
    getSession(),
  ]);

  if (!product) notFound();

  const isAdmin = session?.role === "ADMIN";

  return (
    <BomClient
      product={product}
      bomItems={bomItems}
      jigModels={jigModels}
      isAdmin={isAdmin}
    />
  );
}
