const bcrypt = require('bcryptjs');
const { prisma } = require('../config/prisma');

async function ensureDefaultSuperAdmin() {
  const email = (process.env.SUPERADMIN_EMAIL || 'e@gmail.com').toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || '11111111';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return existing;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  return prisma.user.create({
    data: {
      firstName: 'Super',
      lastName: 'Admin',
      email,
      passwordHash,
      role: 'SUPERADMIN',
    },
  });
}

module.exports = { ensureDefaultSuperAdmin };
