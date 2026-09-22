import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import { authApi } from '../lib/api.js'

const emptyForm = { title: '', description: '', priority: 'medium', category: '', estimated_duration: '', due_date: '', status: 'pending' }
const statusLabels = { pending: 'To do', in_progress: 'In progress', completed: 'Completed' }
const filterStatusLabels = { ...statusLabels, overdue: 'Overdue' }
const priorityLabels = { low: 'Low', medium: 'Medium', high: 'High' }

function formatDate(value) {
  if (!value) return 'No due date'
  const dateValue = String(value).slice(0, 10)
  const date = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(date.getTime())) return 'Invalid due date'

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    .format(date)
}

function AiTaskPreview({ task, onChange, onCancel, onSave, saving }) {
  return (
    <div className="mt-4 rounded-lg border border-accent/30 bg-accent-soft/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="font-semibold text-ink">Review task</h3><p className="mt-1 text-sm text-muted">Edit the extracted details before saving.</p></div>
        <button type="button" onClick={onCancel} className="text-sm text-muted hover:text-ink">Cancel</button>
      </div>
      <div className="mt-4 grid gap-3">
        <label className="text-sm font-medium text-ink">Title<input value={task.title} onChange={(event) => onChange('title', event.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent" /></label>
        <label className="text-sm font-medium text-ink">Description<textarea value={task.description} onChange={(event) => onChange('description', event.target.value)} maxLength={5000} rows="3" className="mt-1 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent" /></label>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm font-medium text-ink">Priority<select value={task.priority} onChange={(event) => onChange('priority', event.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
          <label className="text-sm font-medium text-ink">Category<input value={task.category} onChange={(event) => onChange('category', event.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm" /></label>
          <label className="text-sm font-medium text-ink">Deadline<input type="date" value={task.deadline ?? ''} onChange={(event) => onChange('deadline', event.target.value || null)} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm" /></label>
          <label className="text-sm font-medium text-ink">Duration (min)<input type="number" min="0" max="10080" value={task.estimated_duration ?? ''} onChange={(event) => onChange('estimated_duration', event.target.value === '' ? null : Number(event.target.value))} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm" /></label>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink">Cancel</button>
        <button type="button" onClick={onSave} disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save task'}</button>
      </div>
    </div>
  )
}

function TaskForm({ initialTask, onCancel, onSaved }) {
  const [form, setForm] = useState(initialTask ?? emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const change = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = { ...form, due_date: form.due_date || null }
      const response = await authApi(initialTask ? `/tasks/${initialTask.id}` : '/tasks', {
        method: initialTask ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      onSaved(response.task)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-lg font-semibold text-ink">{initialTask ? 'Edit task' : 'Add task'}</h2><p className="mt-1 text-sm text-muted">Keep the next action clear and easy to find.</p></div>
          <button type="button" aria-label="Close" onClick={onCancel} className="text-xl text-muted hover:text-ink">×</button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-ink">Title
            <input name="title" value={form.title} onChange={change} maxLength={200} required autoFocus className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" />
          </label>
          <label className="block text-sm font-medium text-ink">Description
            <textarea name="description" value={form.description} onChange={change} maxLength={5000} rows="3" className="mt-1 w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium text-ink">Priority
              <select name="priority" value={form.priority} onChange={change} className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent">
                {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-ink">Due date
              <input type="date" name="due_date" value={form.due_date ?? ''} onChange={change} className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" />
            </label>
            <label className="block text-sm font-medium text-ink">Status
              <select name="status" value={form.status} onChange={change} className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent">
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-ink">Category
              <input name="category" value={form.category ?? ''} onChange={change} maxLength={100} className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" />
            </label>
            <label className="block text-sm font-medium text-ink">Duration (min)
              <input type="number" name="estimated_duration" min="0" max="10080" value={form.estimated_duration ?? ''} onChange={(event) => setForm((current) => ({ ...current, estimated_duration: event.target.value === '' ? '' : Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" />
            </label>
          </div>
          {error ? <p className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-canvas">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60">{saving ? 'Saving…' : initialTask ? 'Save changes' : 'Add task'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TaskDetails({ task, onClose, onEdit }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/30 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div><span className={`text-xs font-semibold uppercase tracking-wide ${task.priority === 'high' ? 'text-rose-700' : 'text-muted'}`}>{priorityLabels[task.priority]} priority</span><h2 className="mt-1 text-xl font-semibold text-ink">{task.title}</h2></div>
          <button type="button" aria-label="Close" onClick={onClose} className="text-xl text-muted hover:text-ink">×</button>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted">{task.description || 'No description added.'}</p>
        <dl className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-canvas p-4 text-sm">
          <div><dt className="text-muted">Status</dt><dd className="font-medium text-ink">{statusLabels[task.status]}</dd></div>
          <div><dt className="text-muted">Due</dt><dd className="font-medium text-ink">{formatDate(task.due_date)}</dd></div>
           <div><dt className="text-muted">Category</dt><dd className="font-medium text-ink">{task.category || 'Uncategorized'}</dd></div>
           <div><dt className="text-muted">Duration</dt><dd className="font-medium text-ink">{task.estimated_duration ? `${task.estimated_duration} min` : 'Not estimated'}</dd></div>
        </dl>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink">Close</button><button type="button" onClick={onEdit} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">Edit task</button></div>
      </div>
    </div>
  )
}

export default function Tasks() {
  const [searchParams] = useSearchParams()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(() => searchParams.get('status') === 'overdue' ? 'overdue' : 'all')
  const [priority, setPriority] = useState('all')
  const [sort, setSort] = useState('created_at')
  const [order, setOrder] = useState('desc')
  const [formTask, setFormTask] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [detailsTask, setDetailsTask] = useState(null)
  const [aiText, setAiText] = useState('')
  const [aiPreview, setAiPreview] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiError, setAiError] = useState('')

  const loadTasks = async () => {
    try {
      const response = await authApi('/tasks')
      setTasks(response.tasks ?? [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const retryLoad = () => {
    setLoading(true)
    setError('')
    loadTasks()
  }

  useEffect(() => { loadTasks() }, [])

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase()
    return tasks
      .filter((task) => status === 'all' || (status === 'overdue' ? task.overdue : task.status === status))
      .filter((task) => priority === 'all' || task.priority === priority)
      .filter((task) => !query || `${task.title} ${task.description}`.toLowerCase().includes(query))
      .sort((a, b) => {
        const left = sort === 'title' ? a.title.toLowerCase() : (a[sort] ?? '')
        const right = sort === 'title' ? b.title.toLowerCase() : (b[sort] ?? '')
        const comparison = String(left).localeCompare(String(right), undefined, { numeric: true })
        return order === 'asc' ? comparison : -comparison
      })
  }, [tasks, search, status, priority, sort, order])

  const updateTask = (task) => {
    setTasks((current) => current.map((item) => item.id === task.id ? task : item))
    setShowForm(false); setFormTask(null); setDetailsTask(null)
  }
  const addTask = (task) => { setTasks((current) => [task, ...current]); setShowForm(false) }

  const parseWithAi = async (event) => {
    event.preventDefault()
    setAiError('')
    if (!aiText.trim()) {
      setAiError('Describe the task first.')
      return
    }
    setAiLoading(true)
    try {
      const response = await authApi('/ai/tasks/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText.trim() }),
      })
      setAiPreview(response.task)
    } catch (requestError) {
      setAiError(requestError.message)
    } finally {
      setAiLoading(false)
    }
  }

  const saveAiTask = async () => {
    if (!aiPreview) return
    setAiError('')
    setAiSaving(true)
    try {
      const response = await authApi('/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: aiPreview.title,
          description: aiPreview.description,
          priority: aiPreview.priority,
          category: aiPreview.category,
          estimated_duration: aiPreview.estimated_duration,
          due_date: aiPreview.deadline || null,
          status: 'pending',
        }),
      })
      addTask(response.task)
      setAiPreview(null)
      setAiText('')
    } catch (requestError) {
      setAiError(requestError.message)
    } finally {
      setAiSaving(false)
    }
  }

  const changeStatus = async (task, nextStatus) => {
    try {
      const response = await authApi(`/tasks/${task.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) })
      updateTask(response.task)
    } catch (requestError) { setError(requestError.message) }
  }

  const deleteTask = async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return
    try {
      await authApi(`/tasks/${task.id}`, { method: 'DELETE' })
      setTasks((current) => current.filter((item) => item.id !== task.id))
      if (detailsTask?.id === task.id) setDetailsTask(null)
    } catch (requestError) { setError(requestError.message) }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Tasks" description="Capture, organize, and finish the work that matters." />
      <section className="mb-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div><h2 className="font-semibold text-ink">Describe a task</h2><p className="mt-1 text-sm text-muted">Use plain language and review the details before saving.</p></div>
        <form className="mt-3" onSubmit={parseWithAi}>
          <textarea value={aiText} onChange={(event) => setAiText(event.target.value)} maxLength={5000} rows="2" placeholder="e.g. Prepare the quarterly report by Friday, high priority, about 2 hours" className="w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted">AI suggests details; you stay in control.</span>
            <button type="submit" disabled={aiLoading} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{aiLoading ? 'Understanding…' : 'Add with AI'}</button>
          </div>
        </form>
        {aiError ? <p className="mt-3 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{aiError}</p> : null}
        {aiPreview ? <AiTaskPreview task={aiPreview} onChange={(field, value) => setAiPreview((current) => ({ ...current, [field]: value }))} onCancel={() => { setAiPreview(null); setAiError('') }} onSave={saveAiTask} saving={aiSaving} /> : null}
      </section>
      <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <label className="flex-1"><span className="sr-only">Search tasks</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks…" className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" /></label>
            <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent"><option value="all">All statuses</option>{Object.entries(filterStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select aria-label="Filter by priority" value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent"><option value="all">All priorities</option>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </div>
          <button type="button" onClick={() => { setFormTask(null); setShowForm(true) }} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">+ Add task</button>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm text-muted">
          <span>{visibleTasks.length} {visibleTasks.length === 1 ? 'task' : 'tasks'}</span>
          <label className="flex items-center gap-2"><span>Sort</span><select aria-label="Sort tasks" value={sort} onChange={(event) => setSort(event.target.value)} className="rounded border border-line bg-canvas px-2 py-1 text-sm text-ink"><option value="created_at">Created</option><option value="due_date">Due date</option><option value="priority">Priority</option><option value="title">Title</option><option value="status">Status</option></select><button type="button" aria-label={`Sort ${order === 'asc' ? 'descending' : 'ascending'}`} onClick={() => setOrder((current) => current === 'asc' ? 'desc' : 'asc')} className="rounded border border-line px-2 py-1 text-ink">{order === 'asc' ? '↑' : '↓'}</button></label>
        </div>
      </section>
      {error ? <div className="mt-4 flex items-center justify-between rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-700"><span>{error}</span><button type="button" onClick={retryLoad} className="font-medium underline">Retry</button></div> : null}
      {loading ? <div className="mt-4 rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted">Loading tasks…</div> : null}
      {!loading && !error && visibleTasks.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-line bg-surface p-10 text-center"><h2 className="font-semibold text-ink">{tasks.length ? 'No matching tasks' : 'Your task list is clear'}</h2><p className="mt-1 text-sm text-muted">{tasks.length ? 'Try changing your search or filters.' : 'Add your first task to start making progress.'}</p>{!tasks.length ? <button type="button" onClick={() => setShowForm(true)} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">Add your first task</button> : null}</div> : null}
      {!loading && visibleTasks.length > 0 ? <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{visibleTasks.map((task) => <article key={task.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><button type="button" onClick={() => setDetailsTask(task)} className={`text-left font-medium hover:text-accent ${task.status === 'completed' ? 'text-muted line-through' : 'text-ink'}`}>{task.title}</button><p className="mt-1 line-clamp-1 text-sm text-muted">{task.description || 'No description'}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted"><span className="rounded-full bg-canvas px-2 py-1">{statusLabels[task.status]}</span>{task.overdue ? <span className="rounded-full bg-rose-500/10 px-2 py-1 font-medium text-rose-700">Overdue</span> : null}<span className={`rounded-full px-2 py-1 ${task.priority === 'high' ? 'bg-rose-500/10 text-rose-700' : 'bg-canvas'}`}>{priorityLabels[task.priority]}</span><span>{formatDate(task.due_date)}</span></div></div><div className="flex shrink-0 items-center gap-2"><select aria-label={`Change status for ${task.title}`} value={task.status} onChange={(event) => changeStatus(task, event.target.value)} className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-xs text-ink">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" onClick={() => { setFormTask(task); setShowForm(true) }} className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas">Edit</button><button type="button" onClick={() => deleteTask(task)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-500/10">Delete</button></div></article>)}</div> : null}
      {showForm ? <TaskForm initialTask={formTask} onCancel={() => { setShowForm(false); setFormTask(null) }} onSaved={formTask ? updateTask : addTask} /> : null}
      {detailsTask ? <TaskDetails task={detailsTask} onClose={() => setDetailsTask(null)} onEdit={() => { setFormTask(detailsTask); setDetailsTask(null); setShowForm(true) }} /> : null}
    </div>
  )
}
