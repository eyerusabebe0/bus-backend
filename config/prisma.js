require('dotenv').config({ override: true });

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${
    process.env.PGHOST || 'localhost'
  }:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'busticket'}`;

const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

module.exports = { prisma };
