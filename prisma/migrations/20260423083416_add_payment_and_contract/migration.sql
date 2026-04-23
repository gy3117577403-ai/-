-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'APPROVING', 'PAID');

-- AlterTable
ALTER TABLE "PurchaseRequest" ADD COLUMN     "actualCost" DOUBLE PRECISION,
ADD COLUMN     "contractNo" TEXT,
ADD COLUMN     "invoiceNo" TEXT,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- CreateIndex
CREATE INDEX "PurchaseRequest_paymentStatus_idx" ON "PurchaseRequest"("paymentStatus");
