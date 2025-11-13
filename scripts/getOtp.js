const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const email = process.argv[2];
    if (!email) {
      console.error('Usage: node getOtp.js <email>');
      process.exit(2);
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log('USER_NOT_FOUND');
      await prisma.$disconnect();
      process.exit(0);
    }
    const otp = await prisma.otpVerification.findUnique({ where: { userId: user.id } });
    console.log(JSON.stringify({ userId: user.id, email: user.email, otp }, null, 2));
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
