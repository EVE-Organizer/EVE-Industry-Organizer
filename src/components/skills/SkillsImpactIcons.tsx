function iconClass(className?: string) {
  return className ?? 'size-4'
}

export function IndustryGroupIcon({ className }: { className?: string }) {
  return (
    <svg className={iconClass(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path d="M3 13V6l2.5-2.5L8 6v7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 13V4l2.5-2.5L13 4v9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 13h12" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function ScienceGroupIcon({ className }: { className?: string }) {
  return (
    <svg className={iconClass(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path d="M6 2.5h4" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 2.5v3" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5 13.5h6l-1.5-6H6.5l-1.5 6z" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4.5 10h7" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function MarketGroupIcon({ className }: { className?: string }) {
  return (
    <svg className={iconClass(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="8" cy="8" r="5.5" strokeWidth="1.5" />
      <path d="M8 4.5v7M5.5 6.5c.5-1 1.5-1.5 2.5-1.5s2 .5 2.5 1.5" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.5 9.5c.5 1 1.5 1.5 2.5 1.5s2-.5 2.5-1.5" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function TrainingGroupIcon({ className }: { className?: string }) {
  return (
    <svg className={iconClass(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path d="M2.5 5.5 8 3l5.5 2.5L8 8 2.5 5.5z" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4.5 7v3.5L8 12l3.5-1.5V7" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12.5 6v4.5" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function SlotIcon({ className }: { className?: string }) {
  return (
    <svg className={iconClass(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <rect x="2.5" y="3.5" width="4.5" height="4.5" rx="1" strokeWidth="1.5" />
      <rect x="9" y="3.5" width="4.5" height="4.5" rx="1" strokeWidth="1.5" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" strokeWidth="1.5" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" strokeWidth="1.5" />
    </svg>
  )
}

export function TimeCutIcon({ className }: { className?: string }) {
  return (
    <svg className={iconClass(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="8" cy="8.5" r="5" strokeWidth="1.5" />
      <path d="M8 5.5v3.5l2.5 1.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ReactionIcon({ className }: { className?: string }) {
  return (
    <svg className={iconClass(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path d="M5 12.5c0-2.5 1.5-4 3-5.5S11 4.5 11 2.5" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="5" cy="12.5" r="1" strokeWidth="1.5" />
      <circle cx="11" cy="2.5" r="1" strokeWidth="1.5" />
      <path d="M7.5 8.5h4" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function InventionIcon({ className }: { className?: string }) {
  return (
    <svg className={iconClass(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path d="M8 2.5v11" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5 5.5h6M5 10.5h6" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function TaxIcon({ className }: { className?: string }) {
  return (
    <svg className={iconClass(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path d="M3 12.5h10" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5 9.5l2-4 2 4 2-4 2 4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BrokerIcon({ className }: { className?: string }) {
  return (
    <svg className={iconClass(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path d="M3 5.5h10v7H3z" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M5.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function SpRateIcon({ className }: { className?: string }) {
  return (
    <svg className={iconClass(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path d="M3 8h10" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 5.5 13 8l-3 2.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function QueueIcon({ className }: { className?: string }) {
  return (
    <svg className={iconClass(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path d="M3 4.5h10M3 8h7M3 11.5h4" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
