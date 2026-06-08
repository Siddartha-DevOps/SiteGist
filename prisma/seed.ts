import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding started...");

  // Delete all existing projects and users first to ensure a clean seed
  await prisma.project.deleteMany().catch(() => {});
  await prisma.user.deleteMany().catch(() => {});

  const adminEmail = "founder@sitegist.co";
  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      role: "OWNER",
      subscriptionTier: "pro",
      subscriptionStatus: "active",
    },
  });

  const project = await prisma.project.create({
    data: {
      name: "Default Website Chatbot",
      userId: user.id,
      status: "ACTIVE",
    },
  });

  console.log("Seeding completed successfully ✅");
  console.log(`Created admin user: ${user.email}`);
  console.log(`Created default project: ${project.name}`);
}

main()
  .catch((e) => {
    console.error("Error Seeding Data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
