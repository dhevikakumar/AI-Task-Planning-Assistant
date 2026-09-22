export default function Logo({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-sm font-semibold text-accent">
        Ai
      </span>
      <span className="text-base font-semibold tracking-tight text-ink">
        AItasks
      </span>
    </span>
  )
}
