import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getIncompleteTasks,
  normalizeParsedTaskDeadline,
  prioritizeTasks,
  validatePrioritization,
} from '../src/services/ai.service.js';

const task = (deadline) => ({ title: 'Task', deadline });

test('treats explicit before dates as exclusive', () => {
  assert.equal(
    normalizeParsedTaskDeadline(task('2026-09-21'), 'before 21st September').deadline,
    '2026-09-20',
  );
  assert.equal(
    normalizeParsedTaskDeadline(task('2026-09-21'), 'before September 21').deadline,
    '2026-09-20',
  );
  assert.equal(
    normalizeParsedTaskDeadline(task('2026-09-21'), 'before 21/09/2026').deadline,
    '2026-09-20',
  );
});

test('keeps inclusive deadline wording unchanged', () => {
  for (const text of ['by 21st September', 'on or before 21st September', 'within 21st September']) {
    assert.equal(normalizeParsedTaskDeadline(task('2026-09-21'), text).deadline, '2026-09-21');
  }
});

test('prioritization includes only pending and in-progress tasks', () => {
  const tasks = [
    { id: 1, status: 'pending' },
    { id: 2, status: 'in_progress' },
    { id: 3, status: 'completed' },
  ];

  assert.deepEqual(getIncompleteTasks(tasks).map((task) => task.id), [1, 2]);
});

test('does not call Gemini when there are no incomplete tasks', async () => {
  const result = await prioritizeTasks([{ id: 3, status: 'completed' }]);

  assert.deepEqual(result, []);
});

test('rejects completed task IDs in prioritization responses', () => {
  assert.throws(
    () => validatePrioritization(
      [{ taskId: 3, rank: 1, reason: 'Already done', urgency: 'low' }],
      [{ id: 3, status: 'completed' }],
    ),
    /invalid task/,
  );
});

test('accepts recommendations for pending and in-progress tasks', () => {
  const recommendations = validatePrioritization(
    [
      { taskId: 1, rank: 1, reason: 'Due soon', urgency: 'high' },
      { taskId: 2, rank: 2, reason: 'Continue progress', urgency: 'medium' },
    ],
    [{ id: 1, status: 'pending' }, { id: 2, status: 'in_progress' }],
  );

  assert.deepEqual(recommendations.map((recommendation) => recommendation.taskId), [1, 2]);
});
