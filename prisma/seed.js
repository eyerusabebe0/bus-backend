require('dotenv').config();

const bcrypt = require('bcryptjs');
const { prisma } = require('../config/prisma');

async function main() {
  const email = process.env.SUPERADMIN_EMAIL || 'e@gmail.com';
  const password = process.env.SUPERADMIN_PASSWORD || '11111111';

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPERADMIN',
    },
    create: {
      email,
      passwordHash: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPERADMIN',
    },
  });

  console.log(`✅ Super Admin created: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });