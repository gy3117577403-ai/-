-- AlterTable: BOM 白名单扩展字段（已有库升级）
ALTER TABLE "BomItem" ADD COLUMN IF NOT EXISTS "partNumber" TEXT;
ALTER TABLE "BomItem" ADD COLUMN IF NOT EXISTS "designator" TEXT;
ALTER TABLE "BomItem" ADD COLUMN IF NOT EXISTS "description" TEXT;
