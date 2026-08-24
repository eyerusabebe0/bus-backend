const { prisma } = require('../config/prisma');

function parseBookingDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sanitizeBooking(booking) {
  return {
    id: booking.id,
    userId: booking.userId,
    companyId: booking.companyId,
    scheduleId: booking.scheduleId,
    companyName: booking.schedule?.company?.name || null,
    distance: booking.schedule?.distance || null,
    userFirstName: booking.user?.firstName || null,
    userLastName: booking.user?.lastName || null,
    userEmail: booking.user?.email || booking.passengerEmail || null,
    origin: booking.origin,
    destination: booking.destination,
    departureDate: booking.departureDate,
    departureTime: booking.departureTime,
    arrivalTime: booking.arrivalTime,
    seatNumbers: booking.seatNumbers || [],
    seats: booking.seats,
    total: Number(booking.total),
    payment: booking.payment || null,
    status: booking.status,
    cancelledBy: booking.cancelledBy,
    ticketNumber: booking.ticketNumber,
    busNumber: booking.busNumber,
    createdAt: booking.createdAt,
  };
}

async function getBookings(req, res, next) {
  try {
    const { userId, companyId } = req.query;
    const filter = {};

    if (userId) filter.userId = userId;
    if (companyId) filter.companyId = companyId;

    if (req.user?.role === 'USER') {
      filter.userId = req.user.id;
    }

    if (req.user?.role === 'ADMIN' && req.user.companyId) {
      filter.companyId = req.user.companyId;
    }

    const bookings = await prisma.booking.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        schedule: { include: { company: { select: { name: true } } } },
      },
    });

    return res.status(200).json({ success: true, data: bookings.map(sanitizeBooking) });
  } catch (error) {
    return next(error);
  }
}

async function createBooking(req, res, next) {
  try {
    const { scheduleId, travelDate, seatNumbers, payment, passengerName, passengerEmail, passengerPhone } = req.body;

    if (!scheduleId || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
      return res.status(400).json({ success: false, message: 'Schedule and at least one seat are required.' });
    }

    const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    }

    if (schedule.status !== 'PUBLISHED') {
      return res.status(400).json({ success: false, message: 'This schedule is not available for booking.' });
    }

    const existingBookedSeats = schedule.bookedSeatNumbers || [];
    const conflict = seatNumbers.filter((seat) => existingBookedSeats.includes(Number(seat)));
    if (conflict.length > 0) {
      return res.status(409).json({ success: false, message: `Seat(s) ${conflict.join(', ')} are already taken.` });
    }

    const totalSeats = Number(schedule.totalSeats || 30);
    const nextBookedSeats = [...new Set([...existingBookedSeats, ...seatNumbers.map((seat) => Number(seat))])];
    if (nextBookedSeats.length > totalSeats) {
      return res.status(400).json({ success: false, message: 'Not enough seats available.' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User authentication is required.' });
    }

    const bookingDate = parseBookingDate(travelDate || schedule.travelDate);
    if ((travelDate || schedule.travelDate) && !bookingDate) {
      return res.status(400).json({ success: false, message: 'A valid travel date is required.' });
    }
    const booking = await prisma.booking.create({
      data: {
        userId,
        companyId: schedule.companyId,
        scheduleId: schedule.id,
        origin: schedule.origin,
        destination: schedule.destination,
        departureDate: bookingDate ? bookingDate.toISOString() : null,
        departureTime: schedule.departureTime,
        arrivalTime: schedule.arrivalTime,
        seatNumbers: seatNumbers.map((seat) => Number(seat)),
        seats: seatNumbers.length,
        total: Number(schedule.price) * seatNumbers.length,
        payment: payment || {
          method: 'bank_transfer',
          reference: null,
        },
        passengerName: passengerName || null,
        passengerEmail: passengerEmail || null,
        passengerPhone: passengerPhone || null,
        status: 'CONFIRMED',
      },
      include: { schedule: { include: { company: { select: { name: true } } } } },
    });

    await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        bookedSeatNumbers: nextBookedSeats,
        availableSeats: totalSeats - nextBookedSeats.length,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Booking created successfully.',
      data: sanitizeBooking(booking),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateBookingStatus(req, res, next) {
  try {
    const bookingId = req.params.id;
    const { status, ticketNumber, busNumber } = req.body;

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const nextStatus = status ? status.toUpperCase() : booking.status;
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: nextStatus,
        ticketNumber: ticketNumber || booking.ticketNumber,
        busNumber: busNumber || booking.busNumber,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Booking status updated successfully.',
      data: sanitizeBooking(updatedBooking),
    });
  } catch (error) {
    return next(error);
  }
}

async function cancelBooking(req, res, next) {
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled.' });
    }

    const updatedBooking = await prisma.$transaction(async (transaction) => {
      const schedule = await transaction.schedule.findUnique({ where: { id: booking.scheduleId } });
      const bookedSeatNumbers = (schedule?.bookedSeatNumbers || []).filter(
        (seat) => !booking.seatNumbers.includes(Number(seat)),
      );

      if (schedule) {
        await transaction.schedule.update({
          where: { id: schedule.id },
          data: {
            bookedSeatNumbers,
            availableSeats: Number(schedule.totalSeats) - bookedSeatNumbers.length,
          },
        });
      }

      return transaction.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED' },
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully.',
      data: sanitizeBooking(updatedBooking),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getBookings, createBooking, updateBookingStatus, cancelBooking };
