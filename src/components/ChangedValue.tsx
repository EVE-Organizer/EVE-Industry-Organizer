import { Tooltip } from '@/components/Tooltip'

/** Flash a value that changed on the last refresh. Tooltip shows the previous number. */
export function ChangedValue({
  value,
  previous,
  changedAt,
}: {
  value: string
  previous?: string
  changedAt?: number
}) {
  const fresh = changedAt != null && Date.now() - changedAt < 15_000
  if (!previous || previous === value) return <span>{value}</span>
  return (
    <Tooltip text={`${value} ← ${previous}`} placement="top">
      <span className={fresh ? 'text-warning' : undefined}>{value}</span>
    </Tooltip>
  )
}
