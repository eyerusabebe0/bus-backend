const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

(async () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/busticket';
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  console.log('PRISMA_CLIENT_OK');
  await prisma.$disconnect();
})();
