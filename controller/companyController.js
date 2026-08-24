const bcrypt = require('bcryptjs');
const { prisma } = require('../config/prisma');
const { signToken } = require('../utils/jwt');

function sanitizeCompany(company) {
  return {
    id: company.id,
    name: company.name,
    companyEmail: company.companyEmail,
    phone: company.phone,
    address: company.address,
    adminEmail: company.adminEmail,
    logo: company.logo,
    paymentAccounts: company.paymentAccounts || [],
    status: company.status,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

async function getCompanies(req, res, next) {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: companies.map(sanitizeCompany),
    });
  } catch (error) {
    return next(error);
  }
}

async function createCompany(req, res, next) {
  try {
    const { name, companyEmail, phone, address, adminEmail, adminPassword, logo, paymentAccounts } = req.body;

    if (!name || !companyEmail || !phone || !address || !adminEmail || !adminPassword) {
      return res.status(400).json({ success: false, message: 'All company fields are required.' });
    }

    if (adminPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Admin password must be at least 8 characters long.' });
    }

    const existingCompany = await prisma.company.findFirst({
      where: {
        OR: [{ companyEmail: companyEmail.toLowerCase().trim() }, { adminEmail: adminEmail.toLowerCase().trim() }],
      },
    });

    if (existingCompany) {
      return res.status(409).json({ success: false, message: 'A company or admin email already exists.' });
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const company = await prisma.company.create({
      data: {
        name: name.trim(),
        companyEmail: companyEmail.toLowerCase().trim(),
        phone: phone.trim(),
        address: address.trim(),
        adminEmail: adminEmail.toLowerCase().trim(),
        adminPasswordHash: passwordHash,
        logo: logo || null,
        paymentAccounts: paymentAccounts || [],
        status: 'ACTIVE',
      },
    });

    const adminUser = await prisma.user.create({
      data: {
        firstName: 'Bus',
        lastName: 'Admin',
        email: adminEmail.toLowerCase().trim(),
        passwordHash,
        companyId: company.id,
        role: 'ADMIN',
        phone: phone.trim(),
      },
    });

    const token = signToken({ id: adminUser.id, email: adminUser.email, role: adminUser.role.toUpperCase(), companyId: company.id });

    return res.status(201).json({
      success: true,
      message: 'Bus company and admin account created successfully.',
      data: {
        token,
        company: sanitizeCompany(company),
        admin: {
          id: adminUser.id,
          email: adminUser.email,
          role: adminUser.role,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function updateCompany(req, res, next) {
  try {
    const companyId = req.params.id;
    const { name, companyEmail, phone, address, adminEmail, logo, paymentAccounts, status } = req.body;

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found.' });
    }

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        name: name ? name.trim() : company.name,
        companyEmail: companyEmail ? companyEmail.toLowerCase().trim() : company.companyEmail,
        phone: phone ? phone.trim() : company.phone,
        address: address ? address.trim() : company.address,
        adminEmail: adminEmail ? adminEmail.toLowerCase().trim() : company.adminEmail,
        logo: logo !== undefined ? logo : company.logo,
        paymentAccounts: paymentAccounts !== undefined ? paymentAccounts : company.paymentAccounts,
        status: status ? status.toUpperCase() : company.status,
      },
    });

    if (adminEmail) {
      await prisma.user.updateMany({
        where: { companyId: companyId, role: 'ADMIN' },
        data: { email: adminEmail.toLowerCase().trim() },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Company updated successfully.',
      data: sanitizeCompany(updatedCompany),
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteCompany(req, res, next) {
  try {
    const companyId = req.params.id;

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found.' });
    }

    await prisma.company.delete({ where: { id: companyId } });
    await prisma.user.deleteMany({ where: { companyId } });

    return res.status(200).json({ success: true, message: 'Company deleted successfully.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getCompanies, createCompany, updateCompany, deleteCompany };
