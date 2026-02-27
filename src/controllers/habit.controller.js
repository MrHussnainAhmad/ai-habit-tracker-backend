const Habit = require('../models/Habit');
const HabitLog = require('../models/HabitLog');

const isSameMonth = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const getNextRenewDate = (date) => {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return next.toISOString().split('T')[0];
};

const parseLocalDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const createHabit = async (req, res) => {
  try {
    const { habitName, goal, frequency, difficulty, endDate } = req.body;

    if (!habitName || !goal) {
      return res.status(400).json({ error: 'habitName and goal are required' });
    }

    if (!endDate) {
      return res.status(400).json({ error: 'endDate is required' });
    }

    const end = parseLocalDate(endDate);
    if (!end) {
      return res.status(400).json({ error: 'Invalid endDate' });
    }
    end.setHours(0, 0, 0, 0);
    if (Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid endDate' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (end < today) {
      return res.status(400).json({ error: 'endDate must be today or later' });
    }

    const habit = await Habit.create({
      userId: req.userId,
      habitName,
      goal,
      frequency: frequency || 'daily',
      difficulty: difficulty || 'medium',
      endDate: end,
    });

    res.status(201).json({ message: 'Habit created', habit });
  } catch (err) {
    res.status(500).json({ error: 'Server error creating habit' });
  }
};

const getHabits = async (req, res) => {
  try {
    const habits = await Habit.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ habits });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching habits' });
  }
};

const logHabit = async (req, res) => {
  try {
    const { habitId, date, status, note } = req.body;

    if (!habitId || !date || !status) {
      return res.status(400).json({ error: 'habitId, date, and status are required' });
    }

    const habit = await Habit.findOne({ _id: habitId, userId: req.userId });
    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const logDate = parseLocalDate(date);
    if (!logDate) {
      return res.status(400).json({ error: 'Invalid date' });
    }
    logDate.setHours(0, 0, 0, 0);

    const existing = await HabitLog.findOne({
      userId: req.userId,
      habitId,
      date: logDate,
    });
    if (existing) {
      const next = new Date(logDate);
      next.setDate(next.getDate() + 1);
      return res.status(409).json({
        error: 'Already logged for today',
        nextAvailableDate: next.toISOString().split('T')[0],
      });
    }

    if (habit.endDate) {
      const habitEnd = new Date(habit.endDate);
      habitEnd.setHours(0, 0, 0, 0);
      if (logDate > habitEnd) {
        return res.status(403).json({
          error: `This habit ended on ${habitEnd.toISOString().split('T')[0]}`,
        });
      }
    }

    const log = await HabitLog.findOneAndUpdate(
      { userId: req.userId, habitId, date: logDate },
      { status, note: note || '' },
      { upsert: true, returnDocument: 'after' }
    );

    res.status(201).json({ message: 'Habit logged', log });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Already logged for this date' });
    }
    res.status(500).json({ error: 'Server error logging habit' });
  }
};

const getHistory = async (req, res) => {
  try {
    const { habitId, days } = req.query;

    const filter = { userId: req.userId };

    if (habitId) {
      filter.habitId = habitId;
    }

    const limit = parseInt(days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - limit);
    startDate.setHours(0, 0, 0, 0);
    filter.date = { $gte: startDate };

    const logs = await HabitLog.find(filter)
      .populate('habitId', 'habitName goal frequency difficulty')
      .sort({ date: -1 });

    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching history' });
  }
};

const deleteHabit = async (req, res) => {
  try {
    const { id } = req.params;

    const habit = await Habit.findOne({ _id: id, userId: req.userId });
    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    await HabitLog.deleteMany({ userId: req.userId, habitId: id });
    await Habit.deleteOne({ _id: id, userId: req.userId });

    res.json({ message: 'Habit deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error deleting habit' });
  }
};

const useInsurance = async (req, res) => {
  try {
    const { id } = req.params;

    const habit = await Habit.findOne({ _id: id, userId: req.userId });
    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (habit.endDate) {
      const habitEnd = new Date(habit.endDate);
      habitEnd.setHours(0, 0, 0, 0);
      if (today > habitEnd) {
        return res.status(403).json({
          error: `This habit ended on ${habitEnd.toISOString().split('T')[0]}`,
        });
      }
    }

    if (habit.insuranceLastUsedAt) {
      const last = new Date(habit.insuranceLastUsedAt);
      if (isSameMonth(last, today)) {
        const renewedAt = habit.insuranceRenewedAt
          ? new Date(habit.insuranceRenewedAt)
          : null;
        const canRenewNow = !renewedAt || !isSameMonth(renewedAt, today);
        return res.status(409).json({
          code: 'INSURANCE_USED',
          message: 'Streak insurance already used this month for this habit',
          nextRenewDate: getNextRenewDate(today),
          canRenewNow,
        });
      }
    }

    // For weekly habits, block if already completed this week
    if (habit.frequency === 'weekly') {
      const weekStart = new Date(today);
      const day = weekStart.getDay(); // 0=Sun
      const diff = day === 0 ? 6 : day - 1;
      weekStart.setDate(weekStart.getDate() - diff);
      weekStart.setHours(0, 0, 0, 0);

      const existingWeekly = await HabitLog.findOne({
        userId: req.userId,
        habitId: id,
        status: 'done',
        date: { $gte: weekStart },
      });

      if (existingWeekly) {
        return res.status(409).json({ error: 'Habit already completed this week' });
      }
    }

    const log = await HabitLog.findOneAndUpdate(
      { userId: req.userId, habitId: id, date: today },
      { status: 'done', note: 'Streak insurance' },
      { upsert: true, returnDocument: 'after' }
    );

    habit.insuranceLastUsedAt = new Date();
    await habit.save();

    res.json({ message: 'Streak insurance applied', log, habit });
  } catch (err) {
    res.status(500).json({ error: 'Server error applying streak insurance' });
  }
};

const getInsights = async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const logs = await HabitLog.find({
      userId: req.userId,
      date: { $gte: startDate },
    }).populate('habitId', 'habitName');

    const total = logs.length;
    const doneCount = logs.filter((l) => l.status === 'done').length;
    const skippedCount = logs.filter((l) => l.status === 'skipped').length;
    const completionRate = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    const daySet = new Set(
      logs.map((l) => new Date(l.date).toISOString().split('T')[0])
    );
    const activeDays = daySet.size;

    const habitDoneMap = {};
    logs.forEach((l) => {
      if (l.status !== 'done') return;
      const habitName =
        typeof l.habitId === 'object' ? l.habitId.habitName : null;
      if (!habitName) return;
      habitDoneMap[habitName] = (habitDoneMap[habitName] || 0) + 1;
    });

    const topHabitName =
      Object.entries(habitDoneMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    res.json({
      period: {
        days,
        startDate: startDate.toISOString().split('T')[0],
      },
      completionRate,
      activeDays,
      topHabitName,
      totals: { total, done: doneCount, skipped: skippedCount },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching insights' });
  }
};

const renewInsurance = async (req, res) => {
  try {
    const { id } = req.params;

    const habit = await Habit.findOne({ _id: id, userId: req.userId });
    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (habit.endDate) {
      const habitEnd = new Date(habit.endDate);
      habitEnd.setHours(0, 0, 0, 0);
      if (today > habitEnd) {
        return res.status(403).json({
          error: `This habit ended on ${habitEnd.toISOString().split('T')[0]}`,
        });
      }
    }

    if (!habit.insuranceLastUsedAt) {
      return res.status(400).json({
        error: 'Streak insurance has not been used this month yet',
      });
    }

    const last = new Date(habit.insuranceLastUsedAt);
    if (!isSameMonth(last, today)) {
      return res.status(400).json({
        error: 'Streak insurance has not been used this month yet',
      });
    }

    if (habit.insuranceRenewedAt) {
      const renewedAt = new Date(habit.insuranceRenewedAt);
      if (isSameMonth(renewedAt, today)) {
        return res.status(409).json({
          code: 'INSURANCE_RENEWED',
          message: 'Streak insurance already renewed this month for this habit',
          nextRenewDate: getNextRenewDate(today),
        });
      }
    }

    if (habit.frequency === 'weekly') {
      const weekStart = new Date(today);
      const day = weekStart.getDay();
      const diff = day === 0 ? 6 : day - 1;
      weekStart.setDate(weekStart.getDate() - diff);
      weekStart.setHours(0, 0, 0, 0);

      const existingWeekly = await HabitLog.findOne({
        userId: req.userId,
        habitId: id,
        status: 'done',
        date: { $gte: weekStart },
      });

      if (existingWeekly) {
        return res.status(409).json({ error: 'Habit already completed this week' });
      }
    }

    const log = await HabitLog.findOneAndUpdate(
      { userId: req.userId, habitId: id, date: today },
      { status: 'done', note: 'Streak insurance (renewed)' },
      { upsert: true, returnDocument: 'after' }
    );

    habit.insuranceLastUsedAt = new Date();
    habit.insuranceRenewedAt = new Date();
    await habit.save();

    res.json({ message: 'Streak insurance renewed', log, habit });
  } catch (err) {
    res.status(500).json({ error: 'Server error renewing streak insurance' });
  }
};

module.exports = {
  createHabit,
  getHabits,
  logHabit,
  getHistory,
  deleteHabit,
  useInsurance,
  renewInsurance,
  getInsights,
};
