import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { authApi } from '../lib/api.js'

const priorityLabels = { low: 'Low', medium: 'Medium', high: 'High' }

function formatDate(value) {
  if (!value) return ''
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

export default function DailyPlan() {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generatePlan = async () => {
    setLoading(true)
    setError('')
    try {
      setPlan(await authApi('/ai/plans/daily', { method: 'POST' }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Daily Plan" description="Turn your incomplete tasks into a practical plan for today." />
      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-ink">Today’s schedule</h2>
            <p className="mt-1 text-sm text-muted">{plan ? formatDate(plan.date) : 'Generate a plan when you are ready.'}</p>
          </div>
          <button type="button" onClick={generatePlan} disabled={loading} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? 'Planning…' : plan ? 'Regenerate plan' : 'Generate Today’s Plan'}
          </button>
        </div>
        {error ? <div className="mt-4 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        {loading ? <div className="mt-5 rounded-lg bg-canvas p-8 text-center text-sm text-muted">Building your schedule…</div> : null}
        {!loading && plan && !plan.schedule.length && !plan.unscheduled.length ? <div className="mt-5 rounded-lg bg-canvas p-8 text-center text-sm text-muted">You have no incomplete tasks to plan today.</div> : null}
        {!loading && plan?.schedule.length ? <div className="mt-5 space-y-3">{plan.schedule.map((block, index) => (
          <article key={`${block.type}-${block.taskId ?? index}`} className={`rounded-lg border p-4 ${block.type === 'break' ? 'border-line bg-canvas' : 'border-accent/20 bg-accent-soft/20'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-sm font-semibold text-ink">{block.type === 'break' ? 'Break' : block.task?.title ?? block.title}</p><p className="mt-1 text-sm text-muted">{block.startTime}–{block.endTime} · {block.duration} min</p></div>
              {block.task ? <div className="flex items-center gap-2 text-xs"><span className="rounded-full bg-canvas px-2 py-1 text-muted">{priorityLabels[block.task.priority]} priority</span>{block.task.overdue ? <span className="rounded-full bg-rose-500/10 px-2 py-1 font-medium text-rose-700">Overdue</span> : null}</div> : null}
            </div>
            <p className="mt-3 text-sm text-ink">{block.reason}</p>
          </article>
        ))}</div> : null}
        {!loading && plan?.unscheduled.length ? <div className="mt-6"><h3 className="font-semibold text-ink">Not scheduled today</h3><div className="mt-3 space-y-2">{plan.unscheduled.map((item) => <div key={item.taskId} className="rounded-lg border border-line bg-canvas p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-ink">{item.task.title}</p><span className="text-xs text-muted">{priorityLabels[item.task.priority]} priority{item.task.overdue ? ' · Overdue' : ''}</span></div><p className="mt-1 text-sm text-muted">{item.reason}</p></div>)}</div></div> : null}
      </section>
    </div>
  )
}
