import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { authApi } from '../lib/api.js'

const statusLabels = { pending: 'To do', in_progress: 'In progress', completed: 'Completed' }

function formatDate(value) {
  if (!value) return ''
  const dateValue = String(value).slice(0, 10)
  const date = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
    .format(date)
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [todayTasks, setTodayTasks] = useState([])
  const [overdueTasks, setOverdueTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aiRecommendations, setAiRecommendations] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const loadDashboard = async () => {
    try {
      const response = await authApi('/tasks/stats')
      setStats(response.stats)
      setTodayTasks(response.todayTasks ?? [])
      setOverdueTasks(response.overdueTasks ?? [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const retryLoad = () => {
    setLoading(true)
    setError('')
    loadDashboard()
  }

  const prioritizeWithAi = async () => {
    setAiLoading(true)
    setAiError('')

    try {
      const response = await authApi('/ai/tasks/prioritize', { method: 'POST' })
      setAiRecommendations(response.recommendations ?? [])
    } catch (requestError) {
      setAiError(requestError.message)
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => { loadDashboard() }, [])

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Dashboard" description="A clear view of what is open and what needs your attention today." />
      {error ? <div className="mb-4 flex items-center justify-between rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-700"><span>{error}</span><button type="button" onClick={retryLoad} className="font-medium underline">Retry</button></div> : null}
      {loading ? <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted">Loading your dashboard…</div> : null}
      {!loading && stats ? <><div className="grid gap-4 sm:grid-cols-4">
        <section className="rounded-xl border border-line bg-surface p-5"><p className="text-sm text-muted">Open tasks</p><p className="mt-2 text-3xl font-semibold text-ink">{stats.open ?? 0}</p><p className="mt-1 text-xs text-muted">{stats.total ?? 0} total tasks</p></section>
        <section className="rounded-xl border border-line bg-surface p-5"><p className="text-sm text-muted">Completed today</p><p className="mt-2 text-3xl font-semibold text-ink">{stats.completed_today ?? 0}</p><p className="mt-1 text-xs text-muted">{stats.completed ?? 0} completed overall</p></section>
        <section className="rounded-xl border border-line bg-surface p-5"><p className="text-sm text-muted">Due today</p><p className="mt-2 text-3xl font-semibold text-ink">{stats.due_today ?? 0}</p><p className="mt-1 text-xs text-muted">Keep the focus narrow</p></section>
        <section className="rounded-xl border border-line bg-surface p-5"><p className="text-sm text-muted">Overdue</p><p className="mt-2 text-3xl font-semibold text-rose-700">{stats.overdue ?? 0}</p><p className="mt-1 text-xs text-muted">Incomplete past deadlines</p></section>
      </div>
      <section className="mt-6 rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between"><div><h2 className="font-semibold text-ink">Today’s tasks</h2><p className="mt-1 text-sm text-muted">{todayTasks.length ? 'Your scheduled work for today.' : 'Nothing is scheduled for today.'}</p></div><a href="/tasks" className="text-sm font-medium text-accent hover:underline">View all</a></div>
        {todayTasks.length ? <div className="mt-4 divide-y divide-line">{todayTasks.map((task) => <div key={task.id} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className={`truncate text-sm font-medium ${task.status === 'completed' ? 'text-muted line-through' : 'text-ink'}`}>{task.title}</p><p className="mt-1 text-xs text-muted">{statusLabels[task.status]} · {formatDate(task.due_date)}</p></div><span className="shrink-0 rounded-full bg-canvas px-2 py-1 text-xs text-muted">{task.priority}</span></div>)}</div> : null}
      </section></> : null}
      {!loading && stats ? <section className="mt-6 rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between"><div><h2 className="font-semibold text-ink">Overdue tasks</h2><p className="mt-1 text-sm text-muted">{overdueTasks.length ? 'These incomplete tasks are past their deadlines.' : 'You have no overdue tasks.'}</p></div><a href="/tasks?status=overdue" className="text-sm font-medium text-accent hover:underline">View overdue</a></div>
        {overdueTasks.length ? <div className="mt-4 divide-y divide-line">{overdueTasks.map((task) => <div key={task.id} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{task.title}</p><p className="mt-1 text-xs text-muted">Due {formatDate(task.due_date)} · {statusLabels[task.status]}</p></div><span className="rounded-full bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-700">Overdue</span></div>)}</div> : null}
      </section> : null}
      <section className="mt-6 rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-semibold text-ink">AI task prioritization</h2><p className="mt-1 text-sm text-muted">Get advisory ordering for your tasks without changing any task data.</p></div>
          <button type="button" onClick={prioritizeWithAi} disabled={aiLoading} className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">{aiLoading ? 'Prioritizing…' : aiRecommendations ? 'Refresh priorities' : 'Prioritize with AI'}</button>
        </div>
        {aiError ? <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-700"><span>{aiError}</span><button type="button" onClick={prioritizeWithAi} disabled={aiLoading} className="font-medium underline">Retry</button></div> : null}
        {aiLoading ? <div className="mt-4 rounded-lg bg-canvas p-5 text-center text-sm text-muted">Asking AI for prioritization advice…</div> : null}
        {!aiLoading && aiRecommendations && !aiRecommendations.length ? <div className="mt-4 rounded-lg bg-canvas p-5 text-center text-sm text-muted">You have no tasks to prioritize yet.</div> : null}
        {!aiLoading && aiRecommendations?.length ? <div className="mt-4 space-y-3">{aiRecommendations.map((recommendation) => {
          const task = recommendation.task ?? {}
          return <article key={recommendation.taskId} className="rounded-lg border border-line bg-canvas p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-sm font-semibold text-ink">{recommendation.rank}. {task.title ?? 'Untitled task'}</p><p className="mt-1 text-sm text-muted">{task.description || 'No description provided.'}</p></div>
              <span className="shrink-0 rounded-full bg-accent-soft px-2 py-1 text-xs font-medium text-accent">{recommendation.urgency} urgency</span>
            </div>
            <p className="mt-3 text-sm text-ink"><span className="font-medium">Why:</span> {recommendation.reason}</p>
            <p className="mt-2 text-xs text-muted">{statusLabels[task.status] ?? task.status} · {task.priority} priority · {task.category || 'Uncategorized'}{task.due_date ? ` · Due ${formatDate(task.due_date)}` : ''}{task.estimated_duration ? ` · ${task.estimated_duration} min` : ''}</p>
          </article>
        })}</div> : null}
      </section>
    </div>
  )
}
