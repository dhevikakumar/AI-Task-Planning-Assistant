import { Router } from 'express';
import { queryDatabase } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const statuses = new Set(['pending', 'in_progress', 'completed']);
const priorities = new Set(['low', 'medium', 'high']);
const sortColumns = {
  created_at: 'created_at',
  updated_at: 'updated_at',
  due_date: 'due_date',
  title: 'title',
  priority: 'priority',
  status: 'status',
};

function normalizeStatus(value) {
  return value === 'todo' ? 'pending' : value;
}

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function dateOnlyValue(value) {
  if (!(value instanceof Date)) return value;

  const pad = (part) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function validateTaskInput(input, { partial = false } = {}) {
  const errors = {};
  const data = {};

  if (!partial || input.title !== undefined) {
    if (typeof input.title !== 'string' || !input.title.trim()) {
      errors.title = 'Title is required.';
    } else if (input.title.trim().length > 200) {
      errors.title = 'Title must be 200 characters or fewer.';
    } else {
      data.title = input.title.trim();
    }
  }

  if (!partial || input.description !== undefined) {
    if (input.description !== undefined && typeof input.description !== 'string') {
      errors.description = 'Description must be text.';
    } else if ((input.description ?? '').length > 5000) {
      errors.description = 'Description must be 5,000 characters or fewer.';
    } else {
      data.description = (input.description ?? '').trim();
    }
  }

  if (!partial || input.status !== undefined) {
    const status = normalizeStatus(input.status ?? 'pending');
    if (!statuses.has(status)) {
      errors.status = 'Status must be pending, in_progress, or completed.';
    } else {
      data.status = status;
    }
  }

  if (!partial || input.priority !== undefined) {
    const priority = input.priority ?? 'medium';
    if (!priorities.has(priority)) {
      errors.priority = 'Priority must be low, medium, or high.';
    } else {
      data.priority = priority;
    }
  }

  if (!partial || input.category !== undefined) {
    if (input.category !== undefined && typeof input.category !== 'string') {
      errors.category = 'Category must be text.';
    } else if ((input.category ?? '').trim().length > 100) {
      errors.category = 'Category must be 100 characters or fewer.';
    } else {
      data.category = (input.category ?? '').trim();
    }
  }

  if (!partial || input.estimated_duration !== undefined) {
    const duration = input.estimated_duration;
    if (duration !== undefined && duration !== null && (!Number.isInteger(duration) || duration < 0 || duration > 10080)) {
      errors.estimated_duration = 'Estimated duration must be a whole number of minutes from 0 to 10,080.';
    } else {
      data.estimated_duration = duration ?? null;
    }
  }

  if (!partial || input.due_date !== undefined) {
    if (input.due_date === undefined || input.due_date === null || input.due_date === '') {
      data.due_date = null;
    } else if (!isValidDateOnly(input.due_date)) {
      errors.due_date = 'Due date must be a valid date in YYYY-MM-DD format.';
    } else {
      data.due_date = input.due_date;
    }
  }

  return { data, errors };
}

function taskFromRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    category: row.category,
    estimated_duration: row.estimated_duration,
    due_date: dateOnlyValue(row.due_date),
    completed_at: row.completed_at,
    overdue: row.overdue ?? false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function sendValidationError(res, errors) {
  return res.status(400).json({ message: 'Please correct the highlighted fields.', errors });
}

router.use(authenticate);

router.get('/stats', async (req, res) => {
  try {
    const result = await queryDatabase(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status <> 'completed')::int AS open,
         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
         COUNT(*) FILTER (
           WHERE status = 'completed' AND completed_at::date = CURRENT_DATE
         )::int AS completed_today,
         COUNT(*) FILTER (
           WHERE due_date = CURRENT_DATE AND status <> 'completed'
         )::int AS due_today,
         COUNT(*) FILTER (
           WHERE due_date < CURRENT_DATE AND status <> 'completed'
         )::int AS overdue
       FROM tasks
       WHERE user_id = $1`,
      [req.user.id],
    );
    const todayTasks = await queryDatabase(
      `      SELECT id, user_id, title, description, status, priority, category, estimated_duration, due_date,
              completed_at, due_date < CURRENT_DATE AND status <> 'completed' AS overdue,
              created_at, updated_at
       FROM tasks
       WHERE user_id = $1 AND due_date = CURRENT_DATE
       ORDER BY status = 'completed', priority DESC, title ASC`,
      [req.user.id],
    );

    const overdueTasks = await queryDatabase(
      `SELECT id, user_id, title, description, status, priority, category, estimated_duration, due_date,
              completed_at, true AS overdue, created_at, updated_at
       FROM tasks
       WHERE user_id = $1 AND due_date < CURRENT_DATE AND status <> 'completed'
       ORDER BY due_date ASC, priority DESC, title ASC`,
      [req.user.id],
    );

    return res.json({
      stats: result.rows[0],
      todayTasks: todayTasks.rows.map(taskFromRow),
      overdueTasks: overdueTasks.rows.map(taskFromRow),
    });
  } catch (error) {
    console.error('Task stats error:', error);
    return res.status(500).json({ message: 'Unable to load task statistics.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const values = [req.user.id];
    const conditions = ['user_id = $1'];
    let parameter = 2;

    if (req.query.search) {
      conditions.push(`(title ILIKE $${parameter} OR description ILIKE $${parameter})`);
      values.push(`%${String(req.query.search).slice(0, 100)}%`);
      parameter += 1;
    }
    if (req.query.status && req.query.status !== 'all') {
      const status = normalizeStatus(String(req.query.status));
      if (status === 'overdue') {
        conditions.push("due_date < CURRENT_DATE AND status <> 'completed'");
      } else if (!statuses.has(status)) {
        return res.status(400).json({ message: 'Invalid status filter.' });
      } else {
        conditions.push(`status = $${parameter}`);
        values.push(status);
        parameter += 1;
      }
    }
    if (req.query.priority && req.query.priority !== 'all') {
      if (!priorities.has(String(req.query.priority))) {
        return res.status(400).json({ message: 'Invalid priority filter.' });
      }
      conditions.push(`priority = $${parameter}`);
      values.push(String(req.query.priority));
      parameter += 1;
    }

    const sort = sortColumns[String(req.query.sort)] ?? 'created_at';
    const direction = String(req.query.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const result = await queryDatabase(
      `      SELECT id, user_id, title, description, status, priority, category, estimated_duration, due_date,
              completed_at, due_date < CURRENT_DATE AND status <> 'completed' AS overdue,
              created_at, updated_at
       FROM tasks
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${sort} ${direction} NULLS LAST, id DESC`,
      values,
    );
    return res.json({ tasks: result.rows.map(taskFromRow) });
  } catch (error) {
    console.error('List tasks error:', error);
    return res.status(500).json({ message: 'Unable to load tasks.' });
  }
});

router.post('/', async (req, res) => {
  const { data, errors } = validateTaskInput(req.body ?? {});
  if (Object.keys(errors).length) return sendValidationError(res, errors);

  try {
    const result = await queryDatabase(
      `INSERT INTO tasks (user_id, title, description, status, priority, category, estimated_duration, due_date, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, user_id, title, description, status, priority, category, estimated_duration, due_date,
                 completed_at, (due_date < CURRENT_DATE AND status <> 'completed') AS overdue,
                 created_at, updated_at`,
      [
        req.user.id,
        data.title,
        data.description,
        data.status,
        data.priority,
        data.category,
        data.estimated_duration,
        data.due_date,
        data.status === 'completed' ? new Date() : null,
      ],
    );
    return res.status(201).json({ task: taskFromRow(result.rows[0]) });
  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({ message: 'Unable to create task.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await queryDatabase(
      `      SELECT id, user_id, title, description, status, priority, category, estimated_duration, due_date,
              completed_at, due_date < CURRENT_DATE AND status <> 'completed' AS overdue,
              created_at, updated_at
       FROM tasks WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Task not found.' });
    return res.json({ task: taskFromRow(result.rows[0]) });
  } catch (error) {
    console.error('Get task error:', error);
    return res.status(500).json({ message: 'Unable to load task.' });
  }
});

async function updateTask(req, res, statusOnly = false) {
  const input = req.body ?? {};
  const { data, errors } = validateTaskInput(input, { partial: true });
  if (statusOnly) {
    const status = normalizeStatus(input.status);
    if (!statuses.has(status)) errors.status = 'Status must be pending, in_progress, or completed.';
    else data.status = status;
  }
  if (Object.keys(errors).length) return sendValidationError(res, errors);

  const fields = statusOnly ? ['status'] : Object.keys(data);
  if (!fields.length) return res.status(400).json({ message: 'No changes provided.' });
  const values = [req.params.id, req.user.id];
  const assignments = fields.map((field, index) => {
    values.push(data[field]);
    const parameter = `$${index + 3}`;
    return `${field} = ${field === 'status' ? `${parameter}::varchar(20)` : parameter}`;
  });
  if (fields.includes('status')) {
    assignments.push(
      `completed_at = CASE WHEN $${fields.indexOf('status') + 3}::varchar(20) = 'completed' `
      + 'THEN COALESCE(completed_at, NOW()) ELSE NULL END',
    );
  }
  assignments.push('updated_at = NOW()');

  try {
    const result = await queryDatabase(
      `UPDATE tasks SET ${assignments.join(', ')}
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, title, description, status, priority, category, estimated_duration, due_date,
                 completed_at, (due_date < CURRENT_DATE AND status <> 'completed') AS overdue,
                 created_at, updated_at`,
      values,
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Task not found.' });
    return res.json({ task: taskFromRow(result.rows[0]) });
  } catch (error) {
    console.error('Update task error:', error);
    return res.status(500).json({ message: 'Unable to update task.' });
  }
}

router.patch('/:id/status', (req, res) => updateTask(req, res, true));
router.patch('/:id', (req, res) => updateTask(req, res));
router.put('/:id', (req, res) => updateTask(req, res));

router.delete('/:id', async (req, res) => {
  try {
    const result = await queryDatabase(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Task not found.' });
    return res.status(204).send();
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({ message: 'Unable to delete task.' });
  }
});

export default router;
