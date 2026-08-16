export function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M13.5 2.5v3.5H10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 8a5.5 5.5 0 0 1 9.3-3.9L13.5 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 13.5v-3.5H6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 8a5.5 5.5 0 0 1-9.3 3.9L2.5 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="5.5" cy="10.5" r="2.5" strokeWidth="1.5" />
      <path d="M7.5 8.5L12.5 3.5" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10.5 3.5h2v2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path
        d="M6 2.5H4.5A1.5 1.5 0 0 0 3 4v8a1.5 1.5 0 0 0 1.5 1.5H6"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M10.5 11l3-3-3-3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 8h7" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
