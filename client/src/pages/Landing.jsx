import { Link } from 'react-router-dom'

const features = [
  {
    title: 'Natural language tasks',
    body: 'Add work in plain English. The assistant will structure it for you in a later stage.',
  },
  {
    title: 'Daily planning',
    body: 'Turn your open tasks into a calm, time-boxed plan for the day.',
  },
  {
    title: 'Productivity insights',
    body: 'See completion trends and focused suggestions without noisy dashboards.',
  },
]

export default function Landing() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-accent">Task planning assistant</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Simplify your tasks. Focus on what matters.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">
          AItasks is a smart workspace for creating tasks, building daily
          plans, prioritizing work, and tracking productivity with AI.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/register"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
          >
            Create an account
          </Link>
          <a
            href="#preview"
            className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-accent-soft"
          >
            View app preview
          </a>
        </div>
      </div>

      <div id="preview" className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="rounded-xl border border-line bg-surface p-5"
          >
            <h2 className="text-base font-semibold text-ink">{feature.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{feature.body}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
