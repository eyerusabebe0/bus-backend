const { prisma } = require('../config/prisma');

function toDateOrNull(value, fieldName) {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} must be a valid date.`);
    error.statusCode = 400;
    throw error;
  }

  return date.toISOString();
}

function sanitizeSchedule(schedule) {
  return {
    id: schedule.id,
    companyId: schedule.companyId,
    companyName: schedule.company?.name || null,
    origin: schedule.origin,
    destination: schedule.destination,
    distance: schedule.distance,
    departureTime: schedule.departureTime,
    arrivalTime: schedule.arrivalTime,
    travelDate: schedule.travelDate,
    price: Number(schedule.price),
    totalSeats: schedule.totalSeats,
    bookedSeatNumbers: schedule.bookedSeatNumbers || [],
    availableSeats: schedule.availableSeats,
    status: schedule.status,
    scheduleType: schedule.scheduleType,
    recurrenceDays: schedule.recurrenceDays || [],
    activeFrom: schedule.activeFrom,
    activeUntil: schedule.activeUntil,
    masterId: schedule.masterId,
    createdAt: schedule.createdAt,
  };
}

async function getSchedules(req, res, next) {
  try {
    const { companyId, status } = req.query;
    const filter = {};

    if (companyId) filter.companyId = companyId;
    if (status) filter.status = status.toUpperCase();

    const schedules = await prisma.schedule.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
      include: { company: { select: { id: true, name: true } } },
    });

    return res.status(200).json({
      success: true,
      data: schedules.map(sanitizeSchedule),
    });
  } catch (error) {
    return next(error);
  }
}

async function createSchedule(req, res, next) {
  try {
    const { companyId, origin, destination, departureTime, arrivalTime, travelDate, price, totalSeats, status, scheduleType, recurrenceDays, activeFrom, activeUntil, masterId, distance } = req.body;

    if (!origin || !destination || !departureTime || !price) {
      return res.status(400).json({ success: false, message: 'Origin, destination, departure time, and price are required.' });
    }

    const targetCompanyId = req.user?.role === 'ADMIN' ? req.user.companyId : companyId || req.user?.companyId;
    if (!targetCompanyId) {
      return res.status(400).json({ success: false, message: 'Company identifier is required.' });
    }

    const companyExists = await prisma.company.findUnique({ where: { id: targetCompanyId } });
    if (!companyExists) {
      return res.status(404).json({ success: false, message: 'Company not found.' });
    }

    const scheduleData = {
      companyId: targetCompanyId,
      origin: origin.trim(),
      destination: destination.trim(),
      departureTime,
      arrivalTime: arrivalTime || null,
      travelDate: toDateOrNull(travelDate, 'travelDate'),
      price: Number(price),
      totalSeats: totalSeats ? Number(totalSeats) : 30,
      bookedSeatNumbers: [],
      availableSeats: totalSeats ? Number(totalSeats) : 30,
      status: (status || 'PUBLISHED').toUpperCase(),
      scheduleType: scheduleType || 'single',
      recurrenceDays: recurrenceDays || [],
      activeFrom: toDateOrNull(activeFrom, 'activeFrom'),
      activeUntil: toDateOrNull(activeUntil, 'activeUntil'),
      masterId: masterId || null,
      distance: distance ? Number(distance) : null,
    };

    const schedule = await prisma.schedule.create({
      data: scheduleData,
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Schedule created successfully.',
      data: sanitizeSchedule(schedule),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateSchedule(req, res, next) {
  try {
    const scheduleId = req.params.id;
    const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    }

    const updated = await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        ...req.body,
        travelDate: req.body.travelDate === undefined
          ? schedule.travelDate
          : toDateOrNull(req.body.travelDate, 'travelDate'),
        activeFrom: req.body.activeFrom === undefined
          ? schedule.activeFrom
          : toDateOrNull(req.body.activeFrom, 'activeFrom'),
        activeUntil: req.body.activeUntil === undefined
          ? schedule.activeUntil
          : toDateOrNull(req.body.activeUntil, 'activeUntil'),
        price: req.body.price !== undefined ? Number(req.body.price) : schedule.price,
        totalSeats: req.body.totalSeats !== undefined ? Number(req.body.totalSeats) : schedule.totalSeats,
        availableSeats: req.body.availableSeats !== undefined ? Number(req.body.availableSeats) : schedule.availableSeats,
        status: req.body.status ? req.body.status.toUpperCase() : schedule.status,
      },
      include: { company: { select: { id: true, name: true } } },
    });

    return res.status(200).json({
      success: true,
      message: 'Schedule updated successfully.',
      data: sanitizeSchedule(updated),
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteSchedule(req, res, next) {
  try {
    const scheduleId = req.params.id;
    const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    }

    await prisma.schedule.delete({ where: { id: scheduleId } });

    return res.status(200).json({ success: true, message: 'Schedule deleted successfully.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getSchedules, createSchedule, updateSchedule, deleteSchedule };
