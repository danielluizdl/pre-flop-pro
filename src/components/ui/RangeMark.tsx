const CELLS = [
  true, true, true, true,
  true, true, true, false,
  true, true, false, false,
  true, false, false, false,
]

interface Props {
  size: number
  color?: string
}

export function RangeMark({ size, color = '#d97757' }: Props) {
  const gap    = Math.max(2, Math.round(size / 10))
  const radius = Math.max(2, Math.round(size / 40))
  return (
    <div style={{ display: 'inline-grid', gridTemplateColumns: 'repeat(4,1fr)', gap, width: size, flexShrink: 0 }}>
      {CELLS.map((on, i) => (
        <span key={i} style={{
          aspectRatio: '1',
          borderRadius: radius,
          background: on ? color : 'transparent',
          outline: on ? 'none' : '1px solid rgba(217,119,87,0.10)',
          outlineOffset: -1,
        }} />
      ))}
    </div>
  )
}
