import { Router } from 'express';
import { queryDatabase } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { generateDailyPlan, generateInsights, parseTaskText, prioritizeTasks } from '../services/ai.service.js';
import { getAnalyticsOverview } from '../services/analytics.service.js';

const router = Router();

router.use(authenticate);

router.post('/insights', async (req, res) => {
  try {
    const analytics = await getAnalyticsOverview(req.user.id);
    const result = await queryDatabase(
      `SELECT id, title, status, priority, category, due_date::text AS due_date,
              due_date < CURRENT_DATE AND status <> 'completed' AS overdue
       FROM tasks
       WHERE user_id = $1 AND status <> 'completed'
       ORDER BY due_date ASC NULLS LAST, priority DESC, created_at ASC
       LIMIT 50`,
      [req.user.id],
    );
    const insights = await generateInsights(analytics, result.rows);
    return res.json({ insights });
  } catch (error) {
    if (error.code === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({ message: 'AI productivity insights are not configured on the server.' });
    }
    if (error.code === 'AI_INVALID_RESPONSE') {
      return res.status(502).json({ message: 'The AI provider returned invalid productivity insights.' });
    }
    if (error.code === 'AI_PROVIDER_ERROR') {
      return res.status(502).json({ message: 'The AI provider is temporarily unavailable.' });
    }
    console.error('AI productivity insights error:', error);
    return res.status(500).json({ message: 'Unable to generate productivity insights.' });
  }
});

router.post('/plans/daily', async (req, res) => {
  try {
    const context = await queryDatabase(
      `SELECT id, title, description, status, priority, category, estimated_duration,
              due_date::text AS due_date,
              due_date < CURRENT_DATE AND status <> 'completed' AS overdue
       FROM tasks
       WHERE user_id = $1 AND status <> 'completed'
       ORDER BY due_date ASC NULLS LAST, priority DESC, created_at ASC, id ASC`,
      [req.user.id],
    );
    const now = new Date();
    const dateResult = await queryDatabase('SELECT CURRENT_DATE::text AS plan_date', []);
    const planDate = dateResult.rows[0].plan_date;
    const plan = await generateDailyPlan(context.rows, { now, planDate });
    const tasksById = new Map(context.rows.map((task) => [task.id, task]));

    return res.json({
      ...plan,
      schedule: plan.schedule.map((block) => ({
        ...block,
        task: block.taskId === null ? null : {
          id: tasksById.get(block.taskId).id,
          title: tasksById.get(block.taskId).title,
          priority: tasksById.get(block.taskId).priority,
          overdue: tasksById.get(block.taskId).overdue,
        },
      })),
      unscheduled: plan.unscheduled.map((item) => ({
        ...item,
        task: {
          id: tasksById.get(item.taskId).id,
          title: tasksById.get(item.taskId).title,
          priority: tasksById.get(item.taskId).priority,
          due_date: tasksById.get(item.taskId).due_date,
          overdue: tasksById.get(item.taskId).overdue,
        },
      })),
    });
  } catch (error) {
    if (error.code === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({ message: 'AI daily planning is not configured on the server.' });
    }
    if (error.code === 'AI_INVALID_RESPONSE') {
      return res.status(502).json({ message: 'The AI provider returned an invalid daily plan.' });
    }
    if (error.code === 'AI_PROVIDER_ERROR') {
      return res.status(502).json({ message: 'The AI provider is temporarily unavailable.' });
    }
    console.error('AI daily plan error:', error);
    return res.status(500).json({ message: 'Unable to generate a daily plan.' });
  }
});

router.post('/tasks/prioritize', async (req, res) => {
  try {
    const result = await queryDatabase(
      `SELECT id, title, description, status, priority, category, estimated_duration, due_date::text AS due_date,
              completed_at, created_at, updated_at
       FROM tasks
      WHERE user_id = $1 AND status IN ('pending', 'in_progress')
       ORDER BY created_at ASC, id ASC`,
      [req.user.id],
    );
    const tasks = result.rows;

    if (tasks.length === 0) return res.json({ recommendations: [] });

    const recommendations = await prioritizeTasks(tasks);
    const tasksById = new Map(tasks.map((task) => [task.id, task]));

    return res.json({
      recommendations: recommendations.map((recommendation) => {
        const task = tasksById.get(recommendation.taskId);
        return {
          ...recommendation,
          task: {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            category: task.category,
            estimated_duration: task.estimated_duration,
            due_date: task.due_date,
            completed_at: task.completed_at,
            created_at: task.created_at,
            updated_at: task.updated_at,
          },
        };
      }),
    });
  } catch (error) {
    if (error.code === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({ message: 'AI prioritization is not configured on the server.' });
    }
    if (error.code === 'AI_INVALID_RESPONSE') {
      return res.status(502).json({ message: 'The AI provider returned invalid prioritization advice.' });
    }
    if (error.code === 'AI_PROVIDER_ERROR') {
      return res.status(502).json({ message: 'The AI provider is temporarily unavailable.' });
    }
    console.error('AI task prioritization error:', error);
    return res.status(500).json({ message: 'Unable to prioritize tasks.' });
  }
});

router.post('/tasks/parse', async (req, res) => {
  const text = typeof req.body?.text === 'string'
    ? req.body.text.trim()
    : typeof req.body?.input === 'string'
      ? req.body.input.trim()
      : '';

  if (!text) return res.status(400).json({ message: 'Task text is required.' });
  if (text.length > 5000) return res.status(400).json({ message: 'Task text must be 5,000 characters or fewer.' });

  try {
    const task = await parseTaskText(text);
    return res.json({ success: true, task });
  } catch (error) {
    if (error.code === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({ message: 'AI parsing is not configured on the server.' });
    }
    if (error.code === 'AI_INVALID_RESPONSE') {
      return res.status(502).json({ message: 'The AI provider returned an invalid task.' });
    }
    if (error.code === 'AI_PROVIDER_ERROR') {
      return res.status(502).json({ message: 'The AI provider is temporarily unavailable.' });
    }
    console.error('AI task parse error:', error);
    return res.status(500).json({ message: 'Unable to parse task text.' });
  }
});

export default router;
