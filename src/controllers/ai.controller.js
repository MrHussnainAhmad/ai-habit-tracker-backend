const Habit = require('../models/Habit');
const HabitLog = require('../models/HabitLog');
const User = require('../models/User');
const { getAISuggestion } = require('../services/ai.service');

const getPersonaSystem = (persona) => {
  switch (persona) {
    case 'direct':
      return 'You are a direct, no-nonsense habit coach. Be concise, practical, and action-first. Avoid fluff.';
    case 'motivator':
      return 'You are an upbeat, encouraging habit coach. Be supportive and optimistic while staying specific and practical.';
    case 'calm':
    default:
      return 'You are a calm, empathetic habit coach. Use a steady, reassuring tone and simple, actionable steps.';
  }
};

const getFallback = (focus) => {
  if (!focus?.habit) {
    return 'Create your first habit to get personalized suggestions!';
  }

  const timeByDifficulty = {
    easy: '2 minutes',
    medium: '5 minutes',
    hard: '10 minutes',
  };

  const time = timeByDifficulty[focus.habit.difficulty] || '5 minutes';
  return `Today, do the easiest ${time} version of "${focus.habit.habitName}" to move toward "${focus.habit.goal}".`;
};

const getHabitFallbackPlan = (habit) => {
  if (!habit) {
    return 'Create your first habit to get a personalized plan!';
  }

  const timeByDifficulty = {
    easy: '2 minutes',
    medium: '5 minutes',
    hard: '10 minutes',
  };

  const time = timeByDifficulty[habit.difficulty] || '5 minutes';
  return [
    `Today: Do a ${time} starter session of "${habit.habitName}".`,
    'How: Pick the easiest version and stop when the timer ends.',
    `Why: It builds momentum toward "${habit.goal}".`,
  ].join('\n');
};

const getHabitStats = (habit, logs) => {
  const habitLogs = logs.filter(
    (log) => log.habitId.toString() === habit._id.toString()
  );

  const done = habitLogs.filter((l) => l.status === 'done').length;
  const skipped = habitLogs.filter((l) => l.status === 'skipped').length;
  const total = habitLogs.length;
  const completionRate = total > 0 ? done / total : 0;
  const recentNotes = habitLogs
    .filter((l) => l.note)
    .slice(0, 3)
    .map((l) => l.note);

  return { habit, done, skipped, total, completionRate, recentNotes };
};

const pickFocusHabit = (stats) => {
  if (stats.length === 0) return null;
  const allNoLogs = stats.every((s) => s.total === 0);

  if (allNoLogs) {
    return [...stats].sort(
      (a, b) => new Date(b.habit.createdAt) - new Date(a.habit.createdAt)
    )[0];
  }

  return [...stats].sort((a, b) => {
    if (a.completionRate !== b.completionRate) {
      return a.completionRate - b.completionRate;
    }
    if (a.skipped !== b.skipped) {
      return b.skipped - a.skipped;
    }
    return new Date(b.habit.createdAt) - new Date(a.habit.createdAt);
  })[0];
};

const buildPrompt = (focus) => {
  const habit = focus.habit;
  let prompt = 'Focus habit:\n\n';

  prompt += `Name: ${habit.habitName}\n`;
  prompt += `Goal: ${habit.goal}\n`;
  prompt += `Frequency: ${habit.frequency}\n`;
  prompt += `Difficulty: ${habit.difficulty}\n`;
  prompt += `Last 7 days: ${focus.done} done, ${focus.skipped} skipped\n`;

  if (focus.recentNotes.length > 0) {
    prompt += `Recent notes: ${focus.recentNotes.join('; ')}\n`;
  }

  prompt +=
    '\nTask: Give 1 small, realistic action the user can take today for this habit. ' +
    'Be specific to the habit and goal. Keep it under 80 words. ' +
    'Avoid generic advice. If there are no recent logs, suggest a starter action.';

  return prompt;
};

const buildHabitPrompt = (focus) => {
  const habit = focus.habit;
  let prompt = 'Habit details:\n\n';

  prompt += `Name: ${habit.habitName}\n`;
  prompt += `Goal: ${habit.goal}\n`;
  prompt += `Frequency: ${habit.frequency}\n`;
  prompt += `Difficulty: ${habit.difficulty}\n`;
  prompt += `Last 7 days: ${focus.done} done, ${focus.skipped} skipped\n`;

  if (focus.recentNotes.length > 0) {
    prompt += `Recent notes: ${focus.recentNotes.join('; ')}\n`;
  }

  prompt +=
    '\nTask: Provide a daily action plan for today specific to this habit. ' +
    'Respond in 3 short lines with this exact format:\n' +
    'Today: <one concrete action>\n' +
    'How: <2-3 short steps>\n' +
    'Why: <tie to the goal>\n' +
    'Keep the whole response under 90 words and avoid generic advice.';

  return prompt;
};

const getSuggestion = async (req, res) => {
  let focus = null;
  try {
    const habits = await Habit.find({ userId: req.userId });

    if (habits.length === 0) {
      return res.json({
        suggestion: 'Create your first habit to get personalized suggestions!',
        source: 'system',
      });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const logs = await HabitLog.find({
      userId: req.userId,
      date: { $gte: sevenDaysAgo },
    }).sort({ date: -1 });

    const stats = habits.map((habit) => getHabitStats(habit, logs));
    focus = pickFocusHabit(stats);
    const user = await User.findById(req.userId).select('coachPersona');
    const system = getPersonaSystem(user?.coachPersona);
    const prompt = buildPrompt(focus);
    const aiResponse = await getAISuggestion(prompt, system);

    if (aiResponse) {
      return res.json({ suggestion: aiResponse, source: 'ai' });
    }

    return res.json({ suggestion: getFallback(focus), source: 'fallback' });
  } catch (err) {
    console.error('Suggestion error:', err.message);
    res.json({ suggestion: getFallback(focus), source: 'fallback' });
  }
};

const getHabitSuggestion = async (req, res) => {
  try {
    const { habitId } = req.body;

    if (!habitId) {
      return res.status(400).json({ error: 'habitId is required' });
    }

    const habit = await Habit.findOne({ _id: habitId, userId: req.userId });
    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const logs = await HabitLog.find({
      userId: req.userId,
      habitId,
      date: { $gte: sevenDaysAgo },
    }).sort({ date: -1 });

    const focus = getHabitStats(habit, logs);
    const user = await User.findById(req.userId).select('coachPersona');
    const system = getPersonaSystem(user?.coachPersona);
    const prompt = buildHabitPrompt(focus);
    const aiResponse = await getAISuggestion(prompt, system);

    if (aiResponse) {
      return res.json({ suggestion: aiResponse, source: 'ai' });
    }

    return res.json({ suggestion: getHabitFallbackPlan(habit), source: 'fallback' });
  } catch (err) {
    console.error('Habit suggestion error:', err.message);
    res.json({ suggestion: getHabitFallbackPlan(), source: 'fallback' });
  }
};

const buildHabitQuestionPrompt = (focus, question) => {
  const habit = focus.habit;
  let prompt = 'Habit details:\n\n';

  prompt += `Name: ${habit.habitName}\n`;
  prompt += `Goal: ${habit.goal}\n`;
  prompt += `Frequency: ${habit.frequency}\n`;
  prompt += `Difficulty: ${habit.difficulty}\n`;
  prompt += `Last 7 days: ${focus.done} done, ${focus.skipped} skipped\n`;

  if (focus.recentNotes.length > 0) {
    prompt += `Recent notes: ${focus.recentNotes.join('; ')}\n`;
  }

  prompt += `\nUser question: ${question}\n`;
  prompt +=
    '\nAnswer the question with concise, practical guidance specific to this habit. ' +
    'Keep it under 120 words. Be supportive, not generic.';

  return prompt;
};

const getHabitQuestion = async (req, res) => {
  try {
    const { habitId, question } = req.body;

    if (!habitId || !question) {
      return res.status(400).json({ error: 'habitId and question are required' });
    }

    const habit = await Habit.findOne({ _id: habitId, userId: req.userId });
    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const logs = await HabitLog.find({
      userId: req.userId,
      habitId,
      date: { $gte: sevenDaysAgo },
    }).sort({ date: -1 });

    const focus = getHabitStats(habit, logs);
    const user = await User.findById(req.userId).select('coachPersona');
    const system = getPersonaSystem(user?.coachPersona);
    const prompt = buildHabitQuestionPrompt(focus, String(question).trim());
    const aiResponse = await getAISuggestion(prompt, system);

    if (aiResponse) {
      return res.json({ answer: aiResponse, source: 'ai' });
    }

    return res.json({
      answer: 'I could not generate an answer right now. Please try again.',
      source: 'fallback',
    });
  } catch (err) {
    console.error('Habit question error:', err.message);
    res.json({
      answer: 'I could not generate an answer right now. Please try again.',
      source: 'fallback',
    });
  }
};

module.exports = { getSuggestion, getHabitSuggestion, getHabitQuestion };
