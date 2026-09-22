export default function PlaceholderCard({ title, body }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
    </section>
  )
}
