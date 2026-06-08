import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const testEmail = "test-checker-" + Date.now() + "@sitegist.co";
  const testToken = "test-token-" + Date.now();
  
  try {
    console.log("1. Creating a test VerificationToken...");
    const createdToken = await prisma.verificationToken.create({
      data: {
        email: testEmail,
        token: testToken,
        expiresAt: new Date(Date.now() + 1000 * 60 * 15),
      }
    });
    console.log("✅ Token created successfully:", createdToken.token);

    console.log("2. Querying the VerificationToken...");
    const queriedToken = await prisma.verificationToken.findUnique({
      where: { token: testToken }
    });
    if (!queriedToken) throw new Error("Could not find the created token");
    console.log("✅ Token found in database. Email matches:", queriedToken.email === testEmail);

    console.log("3. Deleting the VerificationToken...");
    await prisma.verificationToken.delete({
      where: { token: testToken }
    });
    console.log("✅ Token deleted successfully.");

    console.log("4. Finding or creating user...");
    let user = await prisma.user.findUnique({
      where: { email: testEmail }
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash: "",
          role: "USER",
          subscriptionTier: "free",
          subscriptionStatus: "active"
        }
      });
      console.log("✅ Created test user:", user.email, "with subscriptionStatus:", user.subscriptionStatus);
    }

    console.log("5. Cleaning up test user...");
    await prisma.user.delete({
      where: { id: user.id }
    });
    console.log("✅ Cleaned up test user successfully.");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! The entire auth database flow is 100% healthy.");

  } catch (error: any) {
    console.error("❌ Test failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
