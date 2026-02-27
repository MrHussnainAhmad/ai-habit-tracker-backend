const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const {
  getProfile,
  updateName,
  updateCoachPersona,
  deleteAccount,
} = require('../controllers/user.controller');

router.get('/me', auth, getProfile);
router.patch('/name', auth, updateName);
router.patch('/coach', auth, updateCoachPersona);
router.delete('/me', auth, deleteAccount);

module.exports = router;
