import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      password: "123456",
      name: "系统管理员",
      role: "ADMIN",
    },
    create: {
      username: "admin",
      password: "123456",
      name: "系统管理员",
      role: "ADMIN",
    },
  });
  console.log("✔ 管理员账号已就绪 (admin / 123456)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
