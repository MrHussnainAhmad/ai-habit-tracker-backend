const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const {
  createHabit,
  getHabits,
  logHabit,
  getHistory,
  deleteHabit,
  useInsurance,
  renewInsurance,
  getInsights,
} = require('../controllers/habit.controller');

router.post('/create', auth, createHabit);
router.get('/', auth, getHabits);
router.post('/log', auth, logHabit);
router.get('/history', auth, getHistory);
router.get('/insights', auth, getInsights);
router.delete('/:id', auth, deleteHabit);
router.post('/:id/insurance', auth, useInsurance);
router.post('/:id/insurance/renew', auth, renewInsurance);

module.exports = router;
