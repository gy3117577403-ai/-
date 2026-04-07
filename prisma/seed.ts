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

  await prisma.systemSetting.upsert({
    where: { key: "systemName" },
    update: { value: "治具管理系统" },
    create: { key: "systemName", value: "治具管理系统" },
  });
  await prisma.systemSetting.upsert({
    where: { key: "announcement" },
    update: { value: "" },
    create: { key: "announcement", value: "" },
  });
  await prisma.systemSetting.upsert({
    where: { key: "enableConfetti" },
    update: { value: "false" },
    create: { key: "enableConfetti", value: "false" },
  });
  console.log("✔ SystemSetting 默认项已写入（systemName / announcement / enableConfetti）");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
