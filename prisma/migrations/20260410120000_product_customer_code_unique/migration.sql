-- 产品规格改为 (customerId, code) 联合唯一，避免不同客户同名主件规格串单
DROP INDEX IF EXISTS "Product_code_key";

CREATE UNIQUE INDEX "Product_customerId_code_key" ON "Product"("customerId", "code");
