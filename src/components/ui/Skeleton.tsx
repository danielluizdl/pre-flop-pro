// Placeholder de carregamento (pulse). Decorativo → aria-hidden; o container
// deve marcar aria-busy. O pulse some com prefers-reduced-motion (CSS base).
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse bg-warm-800 rounded ${className}`} />
}
