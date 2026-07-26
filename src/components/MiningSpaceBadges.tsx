import type { MiningSpaceClass } from '@/types'
import { spaceColor, spaceLabel } from '@/lib/miningIph'

export function MiningSpaceDot({
  space,
  className = '',
}: {
  space: MiningSpaceClass
  className?: string
}) {
  return (
    <span
      className={`inline-block size-2 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: spaceColor(space) }}
      aria-hidden
    />
  )
}

export function MiningSpaceBadges({ spaces }: { spaces: MiningSpaceClass[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {spaces.map((space) => (
        <span
          key={space}
          className="inline-flex items-center gap-1 text-xs whitespace-nowrap"
        >
          <MiningSpaceDot space={space} />
          {spaceLabel(space)}
        </span>
      ))}
    </span>
  )
}
