const bcrypt = require('bcryptjs');
const { prisma } = require('../config/prisma');
const { signToken } = require('../utils/jwt');

function sanitizeUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: String(user.role || 'USER').toLowerCase(),
    phone: user.phone,
    companyId: user.companyId,
    company: user.company
      ? {
          id: user.company.id,
          name: user.company.name,
        }
      : null,
    createdAt: user.createdAt,
  };
}

async function register(req, res, next) {
  try {
    const { firstName, lastName, email, password, companyId } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ success: false, message: 'First name, last name, email, and password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    if (companyId) {
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company not found.' });
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        companyId: companyId || null,
        role: 'USER',
      },
      include: {
        company: {
          select: { id: true, name: true },
        },
      },
    });

    const token = signToken({ id: user.id, email: user.email, role: String(user.role).toUpperCase(), companyId: user.companyId });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        token,
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { company: { select: { id: true, name: true } } },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = signToken({ id: user.id, email: user.email, role: String(user.role).toUpperCase(), companyId: user.companyId });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getCurrentUser(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: {
        user: sanitizeUser({
          ...req.user,
          company: req.user.company || null,
          createdAt: new Date(),
        }),
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login, getCurrentUser };
