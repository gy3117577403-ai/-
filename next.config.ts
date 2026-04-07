import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: false,
  // Prisma Client 需随 standalone 产物一并追踪，避免容器内运行时缺失
  outputFileTracingIncludes: {
    "/*": ["./node_modules/.prisma/**/*", "./prisma/schema.prisma"],
  },
};

export default nextConfig;
