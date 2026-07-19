import { useCallback, useState, type MouseEvent } from 'react'
import { Tooltip } from '@/components/Tooltip'

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M6.25 5.75h5.5a1.25 1.25 0 0 1 1.25 1.25v5.5a1.25 1.25 0 0 1-1.25 1.25h-5.5A1.25 1.25 0 0 1 5 12.5v-5.5a1.25 1.25 0 0 1 1.25-1.25Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M3.75 10.25V4.75A1.25 1.25 0 0 1 5 3.5h5.5"
      />
    </svg>
  )
}

export function CopyNameButton({
  text,
  className,
  iconClassName = 'size-3',
  onClick,
}: {
  text: string
  className?: string
  iconClassName?: string
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      onClick?.(event)
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      } catch {
        setCopied(false)
      }
    },
    [text, onClick],
  )

  return (
    <Tooltip text={copied ? 'Copied' : 'Copy name'} placement="top">
      <button
        type="button"
        className={`btn btn-ghost btn-xs btn-square shrink-0 min-h-0 h-6 w-6 opacity-50 hover:opacity-100 ${className ?? ''}`}
        aria-label={copied ? 'Name copied' : `Copy ${text}`}
        onClick={(event) => void copy(event)}
      >
        <CopyIcon className={iconClassName} />
      </button>
    </Tooltip>
  )
}
