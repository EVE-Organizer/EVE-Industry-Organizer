import { useEffect, useState } from 'react'
import type { ToastTone } from '@/stores/dataStatusStore'
import { useDataStatusStore } from '@/stores/dataStatusStore'

/** One toast stack for refresh summaries. Mounted once from Layout. */
export function ToastHost() {
  const toasts = useDataStatusStore((s) => s.toasts)
  const dismissToast = useDataStatusStore((s) => s.dismissToast)

  return (
    <div className="toast toast-end toast-bottom z-50" aria-live="polite">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  )
}

/** Panel-style toast; tone is a left accent, not a full bright fill. */
function toneClass(tone: ToastTone): string {
  const base =
    'border border-eve-border bg-base-200 text-base-content shadow-lg border-l-4'
  if (tone === 'success') return `${base} border-l-success`
  if (tone === 'warning') return `${base} border-l-warning`
  if (tone === 'error') return `${base} border-l-error`
  return `${base} border-l-info`
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'error') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="size-5 shrink-0"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 7zm0 8a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    )
  }
  if (tone === 'warning') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="size-5 shrink-0"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    )
  }
  if (tone === 'success') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="size-5 shrink-0"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          clipRule="evenodd"
        />
      </svg>
    )
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="size-5 shrink-0"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: { id: string; text: string; tone: ToastTone; persistent?: boolean }
  onDismiss: (id: string) => void
}) {
  const [progress, setProgress] = useState(100)
  const durationMs = toast.persistent ? 0 : 8000

  useEffect(() => {
    if (toast.persistent) return
    const started = Date.now()
    const tick = setInterval(() => {
      const left = Math.max(0, durationMs - (Date.now() - started))
      setProgress((left / durationMs) * 100)
      if (left <= 0) onDismiss(toast.id)
    }, 200)
    return () => clearInterval(tick)
  }, [toast.id, toast.persistent, durationMs, onDismiss])

  return (
    <div
      className={`relative shrink-0 rounded-lg px-3 py-3 pr-14 ${toneClass(toast.tone)} w-[min(calc(100vw-2rem),22rem)]`}
      role="status"
    >
      <div className="flex items-start gap-2.5">
        {toast.persistent ? (
          <span className="loading loading-spinner loading-sm shrink-0 mt-0.5" />
        ) : (
          <span className="shrink-0 mt-0.5 opacity-80">
            <ToastIcon tone={toast.tone} />
          </span>
        )}
        <p className="min-w-0 text-sm leading-snug whitespace-normal break-words">{toast.text}</p>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-xs absolute top-2 right-1 min-h-0 h-auto py-1"
        onClick={() => onDismiss(toast.id)}
      >
        Close
      </button>
      {!toast.persistent ? (
        <div
          className="absolute bottom-0 left-0 h-0.5 rounded-b-lg bg-current opacity-25 transition-all pointer-events-none"
          style={{ width: `${progress}%` }}
        />
      ) : null}
    </div>
  )
}
