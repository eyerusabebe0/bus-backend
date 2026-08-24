const { prisma } = require('../config/prisma');
const { verifyToken } = require('../utils/jwt');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication token is missing.' });
    }

    const decoded = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found for this token.' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: String(user.role).toUpperCase(),
      companyId: user.companyId,
      company: user.company,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

function authorize(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const userRole = String(req.user.role || 'USER').toUpperCase();
    const normalizedAllowedRoles = allowedRoles.map((role) => String(role).toUpperCase());

    if (normalizedAllowedRoles.length > 0 && !normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to access this resource.' });
    }

    return next();
  };
}

module.exports = { authenticate, authorize };
