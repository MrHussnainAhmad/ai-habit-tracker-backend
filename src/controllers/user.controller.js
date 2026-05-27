const User = require('../models/User');
const Habit = require('../models/Habit');
const HabitLog = require('../models/HabitLog');
const { sendAccountDeletedEmail } = require('../services/email.service');

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('email name createdAt coachPersona');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        coachPersona: user.coachPersona,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching profile' });
  }
};

const updateName = async (req, res) => {
  try {
    const { name } = req.body;
    if (name === undefined) {
      return res.status(400).json({ error: 'name is required' });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { name: String(name).trim() },
      { new: true }
    ).select('email name createdAt coachPersona');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        coachPersona: user.coachPersona,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating profile' });
  }
};

const updateCoachPersona = async (req, res) => {
  try {
    const { coachPersona } = req.body;
    const allowed = ['calm', 'direct', 'motivator'];
    if (!allowed.includes(coachPersona)) {
      return res.status(400).json({ error: 'Invalid coachPersona' });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { coachPersona },
      { new: true }
    ).select('email name createdAt coachPersona');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        coachPersona: user.coachPersona,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating coach persona' });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userEmail = user.email;

    await HabitLog.deleteMany({ userId: req.userId });
    await Habit.deleteMany({ userId: req.userId });
    await User.deleteOne({ _id: req.userId });

    const stillExists = await User.exists({ _id: req.userId });
    if (stillExists) {
      return res.status(500).json({ error: 'Failed to delete account completely' });
    }

    sendAccountDeletedEmail(userEmail).catch((err) => {
      console.warn('Account deleted email failed:', err.message);
    });

    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error deleting account' });
  }
};

module.exports = {
  getProfile,
  updateName,
  updateCoachPersona,
  deleteAccount,
};
