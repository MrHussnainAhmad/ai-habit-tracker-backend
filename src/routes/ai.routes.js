const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const { getSuggestion, getHabitSuggestion, getHabitQuestion } = require('../controllers/ai.controller');
const { aiLimiter } = require('../middleware/rateLimiter');

router.post('/suggestion', auth, aiLimiter, getSuggestion);
router.post('/habit-suggestion', auth, aiLimiter, getHabitSuggestion);
router.post('/habit-question', auth, aiLimiter, getHabitQuestion);

module.exports = router;
