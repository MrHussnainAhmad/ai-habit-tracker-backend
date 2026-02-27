const router = require('express').Router();
const {
  signup,
  login,
  requestPasswordReset,
  resetPassword,
  changePassword,
} = require('../controllers/auth.controller');
const { authLimiter } = require('../middleware/rateLimiter');
const auth = require('../middleware/auth.middleware');

router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.post('/request-password-reset', authLimiter, requestPasswordReset);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/change-password', auth, changePassword);

module.exports = router;
