import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import PageHeader from '../components/PageHeader.jsx'
import { authApi } from '../lib/api.js'

const colors = ['#2563eb', '#14b8a6', '#f59e0b', '#f43f5e', '#8b5cf6', '#64748b']
const labels = { pending: 'Pending', in_progress: 'In progress', completed: 'Completed' }

function ChartCard({ title, children }) {
  return <section className="rounded-xl border border-line bg-surface p-5"><h2 className="font-semibold text-ink">{title}</h2><div className="mt-4 h-64">{children}</div></section>
}

export default function Insights() {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [insights, setInsights] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    authApi('/analytics/overview')
      .then(setAnalytics)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [])

  const generateAiInsights = async () => {
    setAiLoading(true)
    setAiError('')
    try {
      const response = await authApi('/ai/insights', { method: 'POST' })
      setInsights(response.insights ?? [])
    } catch (requestError) {
      setAiError(requestError.message)
    } finally {
      setAiLoading(false)
    }
  }

  const summary = analytics?.summary
  const noTasks = summary?.totalTasks === 0

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Insights" description="Understand your productivity patterns and decide where to focus next." />
      {loading ? <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted">Loading your analytics…</div> : null}
      {error ? <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-4 text-sm text-rose-700">{error}</div> : null}
      {!loading && !error && noTasks ? <div className="rounded-xl border border-line bg-surface p-8 text-center"><h2 className="font-semibold text-ink">No task data yet</h2><p className="mt-2 text-sm text-muted">Create a few tasks and complete some of them to see useful productivity analytics.</p></div> : null}
      {!loading && !error && analytics && !noTasks ? <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Total Tasks', summary.totalTasks, 'text-ink'],
            ['Completed', summary.completedTasks, 'text-emerald-700'],
            ['Pending', summary.pendingTasks, 'text-ink'],
            ['In Progress', summary.inProgressTasks, 'text-blue-700'],
            ['Overdue', summary.overdueTasks, 'text-rose-700'],
            ['Completion Rate', `${summary.completionRate}%`, 'text-accent'],
          ].map(([title, value, color]) => <section key={title} className="rounded-xl border border-line bg-surface p-5"><p className="text-sm text-muted">{title}</p><p className={`mt-2 text-3xl font-semibold ${color}`}>{value}</p></section>)}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <ChartCard title="Completion Trend"><ResponsiveContainer width="100%" height="100%"><LineChart data={analytics.completionTrend}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(value) => value.slice(5)} /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line type="monotone" dataKey="created" stroke="#94a3b8" name="Created" /><Line type="monotone" dataKey="completed" stroke="#2563eb" name="Completed" /></LineChart></ResponsiveContainer></ChartCard>
          <ChartCard title="Tasks by Priority"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.tasksByPriority}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
          <ChartCard title="Tasks by Category"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.tasksByCategory} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" fill="#14b8a6" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></ChartCard>
          <ChartCard title="Task Status Distribution"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={analytics.tasksByStatus} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name }) => labels[name] ?? name}>{analytics.tasksByStatus.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip /><Legend formatter={(value) => labels[value] ?? value} /></PieChart></ResponsiveContainer></ChartCard>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><section className="rounded-xl border border-line bg-surface p-5"><p className="text-sm text-muted">Due Today</p><p className="mt-2 text-3xl font-semibold text-ink">{summary.dueToday}</p></section><section className="rounded-xl border border-line bg-surface p-5"><p className="text-sm text-muted">Tasks Without Deadline</p><p className="mt-2 text-3xl font-semibold text-ink">{summary.tasksWithoutDeadline}</p></section></div>
        <section className="mt-6 rounded-xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-ink">AI Productivity Insights</h2><p className="mt-1 text-sm text-muted">Get advisory observations based on your current task data.</p></div><button type="button" onClick={generateAiInsights} disabled={aiLoading} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">{aiLoading ? 'Generating…' : insights ? 'Refresh insights' : 'Generate AI Insights'}</button></div>
          {aiError ? <div className="mt-4 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{aiError}</div> : null}
          {aiLoading ? <div className="mt-4 rounded-lg bg-canvas p-5 text-center text-sm text-muted">Analyzing your productivity data…</div> : null}
          {!aiLoading && insights && !insights.length ? <div className="mt-4 rounded-lg bg-canvas p-5 text-center text-sm text-muted">There are not enough patterns to report yet.</div> : null}
          {!aiLoading && insights?.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{insights.map((insight) => <article key={`${insight.category}-${insight.title}`} className="rounded-lg border border-line bg-canvas p-4"><p className="text-xs font-medium uppercase tracking-wide text-accent">{insight.category}</p><h3 className="mt-1 font-semibold text-ink">{insight.title}</h3><p className="mt-2 text-sm text-muted">{insight.description}</p><p className="mt-3 text-sm text-ink"><span className="font-medium">Recommendation:</span> {insight.recommendation}</p></article>)}</div> : null}
        </section>
      </> : null}
    </div>
  )
}
