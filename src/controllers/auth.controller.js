const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordResetConfirmationEmail,
} = require('../services/email.service');

const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set');
  }
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const generateResetCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const hashResetCode = (code) => {
  return crypto.createHash('sha256').update(code).digest('hex');
};

const signup = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      name: name ? String(name).trim() : '',
    });

    const token = generateToken(user._id);

    sendWelcomeEmail(user.email, user.name).catch((err) => {
      console.warn('Welcome email failed:', err.message);
    });

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: { id: user._id, email: user.email, name: user.name, coachPersona: user.coachPersona },
    });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: 'Server error during signup' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, email: user.email, name: user.name, coachPersona: user.coachPersona },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error during login' });
  }
};

const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.json({
        message: 'If an account exists, a verification code was sent.',
      });
    }

    const code = generateResetCode();
    user.resetCodeHash = hashResetCode(code);
    user.resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    sendPasswordResetEmail(user.email, code).catch((err) => {
      console.warn('Password reset email failed:', err.message);
    });

    return res.json({
      message: 'If an account exists, a verification code was sent.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error requesting password reset' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and newPassword are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.resetCodeHash || !user.resetCodeExpires) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    if (user.resetCodeExpires < new Date()) {
      return res.status(400).json({ error: 'Verification code expired' });
    }

    const isMatch = user.resetCodeHash === hashResetCode(String(code).trim());
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetCodeHash = null;
    user.resetCodeExpires = null;
    await user.save();

    sendPasswordResetConfirmationEmail(user.email).catch((err) => {
      console.warn('Password reset confirmation email failed:', err.message);
    });

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ error: 'Server error resetting password' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error changing password' });
  }
};

module.exports = { signup, login, requestPasswordReset, resetPassword, changePassword };
