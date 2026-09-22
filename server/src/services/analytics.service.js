import { queryDatabase } from '../config/db.js';

function percentage(completed, total) {
  return total === 0 ? 0 : Math.round((completed / total) * 10000) / 100;
}

export async function getAnalyticsOverview(userId) {
  const [summaryResult, priorityResult, categoryResult, statusResult, trendResult] = await Promise.all([
    queryDatabase(
      `SELECT
         COUNT(*)::int AS total_tasks,
         COUNT(*) FILTER (WHERE status <> 'completed')::int AS open_tasks,
         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_tasks,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_tasks,
         COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_tasks,
         COUNT(*) FILTER (WHERE status = 'completed' AND completed_at::date = CURRENT_DATE)::int AS completed_today,
         COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status <> 'completed')::int AS overdue_tasks,
         COUNT(*) FILTER (WHERE due_date = CURRENT_DATE AND status <> 'completed')::int AS due_today,
         COUNT(*) FILTER (WHERE due_date IS NULL)::int AS tasks_without_deadline
       FROM tasks
       WHERE user_id = $1`,
      [userId],
    ),
    queryDatabase(
      `SELECT priority AS name, COUNT(*)::int AS count
       FROM tasks
       WHERE user_id = $1
       GROUP BY priority
       ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`,
      [userId],
    ),
    queryDatabase(
      `SELECT COALESCE(NULLIF(category, ''), 'Uncategorized') AS name, COUNT(*)::int AS count
       FROM tasks
       WHERE user_id = $1
       GROUP BY COALESCE(NULLIF(category, ''), 'Uncategorized')
       ORDER BY count DESC, name ASC`,
      [userId],
    ),
    queryDatabase(
      `SELECT status AS name, COUNT(*)::int AS count
       FROM tasks
       WHERE user_id = $1
       GROUP BY status
       ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END`,
      [userId],
    ),
    queryDatabase(
      `SELECT
         to_char(day_value, 'YYYY-MM-DD') AS date,
         COUNT(tasks.id) FILTER (WHERE tasks.created_at::date = day_value)::int AS created,
         COUNT(tasks.id) FILTER (WHERE tasks.completed_at::date = day_value)::int AS completed
       FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS day_value
       LEFT JOIN tasks ON tasks.user_id = $1
       GROUP BY day_value
       ORDER BY day_value`,
      [userId],
    ),
  ]);

  const summary = summaryResult.rows[0];
  const totalTasks = summary.total_tasks;
  const completedTasks = summary.completed_tasks;

  return {
    summary: {
      totalTasks,
      openTasks: summary.open_tasks,
      completedTasks,
      pendingTasks: summary.pending_tasks,
      inProgressTasks: summary.in_progress_tasks,
      completionRate: percentage(completedTasks, totalTasks),
      completedToday: summary.completed_today,
      overdueTasks: summary.overdue_tasks,
      dueToday: summary.due_today,
      tasksWithoutDeadline: summary.tasks_without_deadline,
    },
    tasksByPriority: priorityResult.rows,
    tasksByCategory: categoryResult.rows,
    tasksByStatus: statusResult.rows,
    completionTrend: trendResult.rows,
  };
}
