const express = require('express');
const { register, login, getCurrentUser } = require('../controller/authController');
const { getCompanies, createCompany, updateCompany, deleteCompany } = require('../controller/companyController');
const { getSchedules, createSchedule, updateSchedule, deleteSchedule } = require('../controller/scheduleController');
const { getBookings, createBooking, updateBookingStatus, cancelBooking } = require('../controller/bookingController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Backend is healthy.' });
});

router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', authenticate, getCurrentUser);

router.get('/companies', getCompanies);
router.post('/companies', authenticate, authorize(['SUPERADMIN']), createCompany);
router.put('/companies/:id', authenticate, authorize(['SUPERADMIN']), updateCompany);
router.delete('/companies/:id', authenticate, authorize(['SUPERADMIN']), deleteCompany);

router.get('/schedules', authenticate, authorize(['SUPERADMIN', 'ADMIN', 'USER']), getSchedules);
router.post('/schedules', authenticate, authorize(['ADMIN', 'SUPERADMIN']), createSchedule);
router.put('/schedules/:id', authenticate, authorize(['ADMIN', 'SUPERADMIN']), updateSchedule);
router.delete('/schedules/:id', authenticate, authorize(['ADMIN', 'SUPERADMIN']), deleteSchedule);

router.get('/bookings', authenticate, authorize(['SUPERADMIN', 'ADMIN', 'USER']), getBookings);
router.post('/bookings', authenticate, authorize(['USER']), createBooking);
router.patch('/bookings/:id/cancel', authenticate, authorize(['USER']), cancelBooking);
router.patch('/bookings/:id/status', authenticate, authorize(['ADMIN', 'SUPERADMIN']), updateBookingStatus);

module.exports = router;
