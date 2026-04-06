import { notFound } from "next/navigation";
import {
  getBomItems,
  getProductWithCustomer,
  getAvailableJigModels,
} from "@/lib/actions/bom";
import { BomClient } from "./bom-client";

export default async function BomPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;

  const [product, bomItems, jigModels] = await Promise.all([
    getProductWithCustomer(productId),
    getBomItems(productId),
    getAvailableJigModels(),
  ]);

  if (!product) notFound();

  return (
    <BomClient
      product={product}
      bomItems={bomItems}
      jigModels={jigModels}
    />
  );
}
