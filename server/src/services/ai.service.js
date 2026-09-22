import { env } from '../config/env.js';

const priorities = new Set(['low', 'medium', 'high']);
const categories = new Set(['Work', 'Study', 'Personal', 'Project', 'Other']);
const insightCategories = new Set(['completion', 'focus', 'deadlines', 'workload', 'priorities']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthNumbers = new Map([
  ['january', 1], ['february', 2], ['march', 3], ['april', 4],
  ['may', 5], ['june', 6], ['july', 7], ['august', 8],
  ['september', 9], ['october', 10], ['november', 11], ['december', 12],
]);
const responseSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'A concise task title.' },
    description: { type: 'STRING', description: 'Useful task details and next action.' },
    priority: { type: 'STRING', enum: ['low', 'medium', 'high'] },
    category: { type: 'STRING', enum: [...categories] },
    deadline: {
      type: 'STRING',
      nullable: true,
      description: 'Deadline as YYYY-MM-DD, or null when none is stated.',
    },
    estimated_duration: {
      type: 'INTEGER',
      nullable: true,
      description: 'Estimated duration in minutes, or null when it cannot be inferred.',
    },
  },
  required: ['title', 'description', 'priority', 'category', 'deadline', 'estimated_duration'],
};
const prioritizationResponseSchema = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      taskId: { type: 'INTEGER', description: 'The id of one of the supplied tasks.' },
      rank: { type: 'INTEGER', description: 'The recommended order, starting at 1.' },
      reason: { type: 'STRING', description: 'A concise explanation for this recommendation.' },
      urgency: { type: 'STRING', enum: ['low', 'medium', 'high'] },
    },
    required: ['taskId', 'rank', 'reason', 'urgency'],
  },
};
const dailyPlanResponseSchema = {
  type: 'OBJECT',
  properties: {
    date: { type: 'STRING', description: 'Plan date as YYYY-MM-DD.' },
    schedule: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          taskId: { type: 'INTEGER', nullable: true },
          title: { type: 'STRING' },
          startTime: { type: 'STRING', description: '24-hour HH:MM local time.' },
          endTime: { type: 'STRING', description: '24-hour HH:MM local time.' },
          duration: { type: 'INTEGER' },
          type: { type: 'STRING', enum: ['task', 'break'] },
          reason: { type: 'STRING' },
        },
        required: ['taskId', 'title', 'startTime', 'endTime', 'duration', 'type', 'reason'],
      },
    },
    unscheduled: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          taskId: { type: 'INTEGER' },
          reason: { type: 'STRING' },
        },
        required: ['taskId', 'reason'],
      },
    },
  },
  required: ['date', 'schedule', 'unscheduled'],
};
const insightsResponseSchema = {
  type: 'OBJECT',
  properties: {
    insights: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING', enum: [...insightCategories] },
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          recommendation: { type: 'STRING' },
        },
        required: ['category', 'title', 'description', 'recommendation'],
      },
    },
  },
  required: ['insights'],
};

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function formatDateOnly(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function parseExplicitBeforeDate(text, deadline) {
  const numericMatch = text.match(/(?<!\bor )\bbefore\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\b/i);
  const dayMonthMatch = text.match(
    /(?<!\bor )\bbefore\s+(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\b/i,
  );
  const monthDayMatch = text.match(
    /(?<!\bor )\bbefore\s+([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
  );

  let year;
  let month;
  let day;
  if (numericMatch) {
    [, day, month, year] = numericMatch.map(Number);
  } else if (dayMonthMatch && monthNumbers.has(dayMonthMatch[2].toLowerCase())) {
    day = Number(dayMonthMatch[1]);
    month = monthNumbers.get(dayMonthMatch[2].toLowerCase());
    year = Number(deadline.slice(0, 4));
  } else if (monthDayMatch && monthNumbers.has(monthDayMatch[1].toLowerCase())) {
    month = monthNumbers.get(monthDayMatch[1].toLowerCase());
    day = Number(monthDayMatch[2]);
    year = Number(deadline.slice(0, 4));
  } else {
    return deadline;
  }

  const requestedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (!isValidDateOnly(deadline) || !isValidDateOnly(formatDateOnly(requestedDate))) return deadline;
  if (deadline !== formatDateOnly(requestedDate)) return deadline;

  requestedDate.setUTCDate(requestedDate.getUTCDate() - 1);
  return formatDateOnly(requestedDate);
}

export function normalizeParsedTaskDeadline(value, text) {
  if (!value || typeof value !== 'object' || value.deadline === null || value.deadline === '') {
    return value;
  }

  const deadline = parseExplicitBeforeDate(text, value.deadline);
  return deadline === value.deadline ? value : { ...value, deadline };
}

function parseJson(text) {
  const withoutFence = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The AI response was not valid JSON.');
  return JSON.parse(withoutFence.slice(start, end + 1));
}

function parseJsonValue(text) {
  const withoutFence = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  try {
    return JSON.parse(withoutFence);
  } catch {
    const starts = [withoutFence.indexOf('['), withoutFence.indexOf('{')]
      .filter((index) => index >= 0)
      .sort((left, right) => left - right);
    const start = starts[0];
    const end = Math.max(withoutFence.lastIndexOf(']'), withoutFence.lastIndexOf('}'));
    if (start === undefined || end <= start) throw new Error('The AI response was not valid JSON.');
    return JSON.parse(withoutFence.slice(start, end + 1));
  }
}

export function validateParsedTask(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The AI response did not contain a task object.');
  }

  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  const categoryValue = typeof value.category === 'string' ? value.category.trim() : '';
  const category = [...categories].find(
    (allowedCategory) => allowedCategory.toLowerCase() === categoryValue.toLowerCase(),
  ) ?? '';
  const priority = typeof value.priority === 'string' ? value.priority.toLowerCase() : '';
  const deadline = value.deadline === null || value.deadline === '' ? null : value.deadline;
  const estimatedDuration = value.estimated_duration === null || value.estimated_duration === ''
    ? null
    : value.estimated_duration;

  if (!title || title.length > 200) throw new Error('The AI response contained an invalid title.');
  if (description.length > 5000) throw new Error('The AI response contained an invalid description.');
  if (!priorities.has(priority)) throw new Error('The AI response contained an invalid priority.');
  if (!category) throw new Error('The AI response contained an invalid category.');
  if (deadline !== null && !isValidDateOnly(deadline)) {
    throw new Error('The AI response contained an invalid deadline.');
  }
  if (estimatedDuration !== null
    && (!Number.isInteger(estimatedDuration) || estimatedDuration <= 0 || estimatedDuration > 10080)) {
    throw new Error('The AI response contained an invalid estimated duration.');
  }

  return {
    title,
    description,
    priority,
    category,
    deadline,
    estimated_duration: estimatedDuration,
  };
}

function providerError(message, cause) {
  const error = new Error(message);
  error.code = 'AI_PROVIDER_ERROR';
  error.cause = cause;
  return error;
}

export async function parseTaskText(text, { now = new Date() } = {}) {
  if (env.aiProvider !== 'gemini') {
    throw providerError(`Unsupported AI provider: ${env.aiProvider || 'none'}.`);
  }
  if (!env.geminiApiKey) {
    const error = new Error('AI parsing is not configured. Set GEMINI_API_KEY on the server.');
    error.code = 'AI_NOT_CONFIGURED';
    throw error;
  }

  const prompt = [
    'Convert the user text into exactly one task object matching the supplied JSON schema.',
    'Do not invent a deadline or duration when the text does not provide enough information; use null.',
    'Treat "before" as strictly exclusive: for example, "before 21st September" means 20th September. Treat "by", "on or before", and "within" as inclusive and keep the stated date.',
    'Resolve relative dates using the current date and time below. Use the user language only as task content.',
    `Current date and time (UTC): ${now.toISOString()}`,
    `User text: ${text}`,
  ].join('\n');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.geminiModel)}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;

  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema,
          },
        }),
      });
    } catch (error) {
      throw providerError('The AI provider could not be reached.', error);
    }

    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) break;
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }

  if (!response.ok) {
    throw providerError('The AI provider returned an error.', new Error(`HTTP ${response.status}`));
  }

  let payload;
  try {
    payload = await response.json();
    const generatedText = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('');
    if (!generatedText) throw new Error('Missing generated content.');
    return validateParsedTask(normalizeParsedTaskDeadline(parseJson(generatedText), text));
  } catch (error) {
    if (error.message.startsWith('The AI response')) {
      error.code = 'AI_INVALID_RESPONSE';
      throw error;
    }
    const wrapped = providerError('The AI provider returned an invalid response.', error);
    wrapped.code = 'AI_INVALID_RESPONSE';
    throw wrapped;
  }
}

function invalidPrioritizationResponse(message) {
  const error = new Error(message);
  error.code = 'AI_INVALID_RESPONSE';
  return error;
}

export function validatePrioritization(value, tasks) {
  const recommendations = Array.isArray(value)
    ? value
    : value && Array.isArray(value.recommendations)
      ? value.recommendations
      : null;

  if (!recommendations) throw invalidPrioritizationResponse('The AI response did not contain recommendations.');

  const taskIds = new Set(
    getIncompleteTasks(tasks).map((task) => String(task.id)),
  );
  const seenTaskIds = new Set();

  return recommendations.map((recommendation) => {
    if (!recommendation || typeof recommendation !== 'object' || Array.isArray(recommendation)) {
      throw invalidPrioritizationResponse('The AI response contained an invalid recommendation.');
    }

    const taskId = Number(recommendation.taskId ?? recommendation.task_id);
    const rank = Number(recommendation.rank);
    const reason = typeof recommendation.reason === 'string' ? recommendation.reason.trim() : '';
    const urgency = typeof recommendation.urgency === 'string'
      ? recommendation.urgency.trim().toLowerCase()
      : '';

    if (!Number.isSafeInteger(taskId) || !taskIds.has(String(taskId))) {
      throw invalidPrioritizationResponse('The AI response referenced an invalid task.');
    }
    if (seenTaskIds.has(String(taskId))) {
      throw invalidPrioritizationResponse('The AI response contained duplicate tasks.');
    }
    if (!Number.isSafeInteger(rank) || rank < 1) {
      throw invalidPrioritizationResponse('The AI response contained an invalid rank.');
    }
    if (!reason || reason.length > 1000) {
      throw invalidPrioritizationResponse('The AI response contained an invalid reason.');
    }
    if (!['low', 'medium', 'high'].includes(urgency)) {
      throw invalidPrioritizationResponse('The AI response contained an invalid urgency.');
    }

    seenTaskIds.add(String(taskId));
    return { taskId, rank, reason, urgency };
  });
}

export function getIncompleteTasks(tasks) {
  return tasks.filter((task) => task.status === 'pending' || task.status === 'in_progress');
}

async function callGemini(prompt, schema) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.geminiModel)}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;
  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: schema },
        }),
      });
    } catch (error) {
      throw providerError('The AI provider could not be reached.', error);
    }
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) break;
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  if (!response.ok) throw providerError('The AI provider returned an error.', new Error(`HTTP ${response.status}`));
  const payload = await response.json();
  const generatedText = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
  if (!generatedText) throw invalidPrioritizationResponse('The AI provider returned no content.');
  return parseJsonValue(generatedText);
}

async function requireGemini() {
  if (env.aiProvider !== 'gemini') throw providerError(`Unsupported AI provider: ${env.aiProvider || 'none'}.`);
  if (!env.geminiApiKey) {
    const error = new Error('AI service is not configured.');
    error.code = 'AI_NOT_CONFIGURED';
    throw error;
  }
}

export async function prioritizeTasks(tasks) {
  const incompleteTasks = getIncompleteTasks(tasks);
  if (incompleteTasks.length === 0) return [];

  await requireGemini();
  try {
    const value = await callGemini([
      'Prioritize the supplied tasks. Return one recommendation for every task.',
      'Use only supplied taskId values, rank from 1, and keep reasons concise.',
      `Tasks (JSON): ${JSON.stringify(incompleteTasks.map(({ id, title, description, status, priority, category, estimated_duration, due_date }) => ({ taskId: id, title, description, status, priority, category, estimated_duration, due_date })))}`,
    ].join('\n'), prioritizationResponseSchema);
    return validatePrioritization(value, incompleteTasks);
  } catch (error) {
    if (error.code === 'AI_INVALID_RESPONSE') throw error;
    if (error.code === 'AI_PROVIDER_ERROR') throw error;
    const wrapped = providerError('The AI provider returned an invalid response.', error);
    wrapped.code = 'AI_INVALID_RESPONSE';
    throw wrapped;
  }
}

function invalidDailyPlan(message) {
  const error = new Error(message);
  error.code = 'AI_INVALID_RESPONSE';
  return error;
}

function isTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function validateDailyPlan(value, tasks, planDate) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.date !== planDate || !Array.isArray(value.schedule) || !Array.isArray(value.unscheduled)) {
    throw invalidDailyPlan('The AI response contained an invalid daily plan.');
  }
  const taskIds = new Set(tasks.map((task) => String(task.id)));
  const scheduled = new Set();
  const unscheduled = new Set();
  const schedule = value.schedule.map((block) => {
    const taskId = block?.taskId === null || block?.taskId === undefined ? null : Number(block.taskId);
    const valid = block && typeof block === 'object' && ['task', 'break'].includes(block.type)
      && typeof block.title === 'string' && block.title.trim()
      && typeof block.reason === 'string' && block.reason.trim()
      && isTime(block.startTime) && isTime(block.endTime)
      && Number.isSafeInteger(Number(block.duration)) && Number(block.duration) > 0;
    if (!valid || (block.type === 'task' && (!Number.isSafeInteger(taskId) || !taskIds.has(String(taskId)) || scheduled.has(String(taskId))))
      || (block.type === 'break' && taskId !== null)) {
      throw invalidDailyPlan('The AI response contained an invalid schedule block.');
    }
    if (block.type === 'task') scheduled.add(String(taskId));
    return { taskId, title: block.title.trim(), startTime: block.startTime, endTime: block.endTime, duration: Number(block.duration), type: block.type, reason: block.reason.trim() };
  });
  const unscheduledTasks = value.unscheduled.map((item) => {
    const taskId = Number(item?.taskId);
    if (!Number.isSafeInteger(taskId) || !taskIds.has(String(taskId)) || scheduled.has(String(taskId)) || unscheduled.has(String(taskId)) || typeof item.reason !== 'string' || !item.reason.trim()) {
      throw invalidDailyPlan('The AI response contained an invalid unscheduled task.');
    }
    unscheduled.add(String(taskId));
    return { taskId, reason: item.reason.trim() };
  });
  if (scheduled.size + unscheduled.size !== taskIds.size) throw invalidDailyPlan('Every task must be scheduled or explained as unscheduled.');
  return { date: planDate, schedule, unscheduled: unscheduledTasks };
}

export async function generateDailyPlan(tasks, { now = new Date(), planDate } = {}) {
  if (!tasks.length) return { date: planDate, schedule: [], unscheduled: [] };
  await requireGemini();
  try {
    const value = await callGemini([
      'Create a practical schedule for today from these incomplete tasks.',
      `Today is ${planDate}. Current time is ${now.toISOString()}.`,
      'Consider priority, deadline, overdue, estimated duration, and status. Use breaks and explain every task that does not fit.',
      `Tasks (JSON): ${JSON.stringify(tasks.map(({ id, title, description, priority, category, due_date, estimated_duration, status, overdue }) => ({ taskId: id, title, description, priority, category, deadline: due_date, estimated_duration, status, overdue })))}`,
    ].join('\n'), dailyPlanResponseSchema);
    return validateDailyPlan(value, tasks, planDate);
  } catch (error) {
    if (error.code === 'AI_INVALID_RESPONSE') throw error;
    if (error.code === 'AI_PROVIDER_ERROR') throw error;
    const wrapped = providerError('The AI provider returned an invalid response.', error);
    wrapped.code = 'AI_INVALID_RESPONSE';
    throw wrapped;
  }

}

function invalidInsights(message) {
  const error = new Error(message);
  error.code = 'AI_INVALID_RESPONSE';
  return error;
}

export function validateInsights(value) {
  const insights = value && Array.isArray(value.insights) ? value.insights : null;
  if (!insights || insights.length > 5) {
    throw invalidInsights('The AI response contained an invalid insights list.');
  }

  return insights.map((insight) => {
    if (!insight || typeof insight !== 'object' || Array.isArray(insight)
      || !insightCategories.has(insight.category)
      || typeof insight.title !== 'string' || !insight.title.trim() || insight.title.length > 120
      || typeof insight.description !== 'string' || !insight.description.trim() || insight.description.length > 500
      || typeof insight.recommendation !== 'string' || !insight.recommendation.trim() || insight.recommendation.length > 500) {
      throw invalidInsights('The AI response contained an invalid productivity insight.');
    }

    return {
      category: insight.category,
      title: insight.title.trim(),
      description: insight.description.trim(),
      recommendation: insight.recommendation.trim(),
    };
  });
}

export async function generateInsights(analytics, tasks) {
  await requireGemini();
  try {
    const value = await callGemini([
      'Generate concise, advisory productivity insights from the supplied analytics only.',
      'Do not invent metrics, dates, trends, or facts. Do not mention data that is not supplied.',
      'Return at most five insights. Do not suggest changing task records or priorities automatically.',
      `Analytics (JSON): ${JSON.stringify(analytics)}`,
      `Relevant incomplete tasks (JSON): ${JSON.stringify(tasks.map(({ id, title, status, priority, category, due_date, overdue }) => ({ id, title, status, priority, category, due_date, overdue })))}`,
    ].join('\n'), insightsResponseSchema);
    return validateInsights(value);
  } catch (error) {
    if (error.code === 'AI_INVALID_RESPONSE') throw error;
    if (error.code === 'AI_PROVIDER_ERROR') throw error;
    const wrapped = providerError('The AI provider returned invalid productivity insights.', error);
    wrapped.code = 'AI_INVALID_RESPONSE';
    throw wrapped;
  }
}
