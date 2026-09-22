export default function PageHeader({ title, description }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      {description ? (
        <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
      ) : null}
    </header>
  )
}
