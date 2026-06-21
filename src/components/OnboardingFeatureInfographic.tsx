import type { ReactNode } from 'react'

interface FeatureDef {
  title: string
  tagline: string
  highlights: string[]
  accent: string
  illustration: ReactNode
}

function BlueprintIllustration() {
  return (
    <svg viewBox="0 0 320 120" className="w-full h-auto" aria-hidden>
      <rect width="320" height="120" fill="#0d1117" rx="6" />
      <rect x="8" y="8" width="304" height="22" fill="#161b22" rx="4" />
      {['T1', 'T2', 'Faction', '1d', '1w', '1m'].map((label, i) => (
        <g key={label}>
          <rect
            x={12 + i * 48}
            y="12"
            width={42}
            height="14"
            rx="3"
            fill={i === 0 ? '#f5a623' : '#21262d'}
            opacity={i === 0 ? 0.35 : 1}
          />
          <text x={22 + i * 48} y="22" fill="#8b949e" fontSize="8" fontFamily="system-ui">
            {label}
          </text>
        </g>
      ))}
      {[0, 1, 2, 3].map((row) => (
        <g key={row}>
          <rect x="8" y={38 + row * 20} width="304" height="18" fill="#161b22" rx="3" />
          <rect x="12" y={42 + row * 20} width="80" height="10" fill="#30363d" rx="2" />
          <text x="100" y={50 + row * 20} fill="#8b949e" fontSize="8" fontFamily="system-ui">
            ME0
          </text>
          <text
            x="140"
            y={50 + row * 20}
            fill={row === 0 ? '#3fb950' : '#e6edf3'}
            fontSize="9"
            fontWeight={row === 0 ? 600 : 400}
            fontFamily="system-ui"
          >
            {['+12.4M', '+8.1M', '+5.2M', '+3.8M'][row]}
          </text>
          <text x="200" y={50 + row * 20} fill="#8b949e" fontSize="8" fontFamily="system-ui">
            ME10
          </text>
          <text x="240" y={50 + row * 20} fill="#4a9eff" fontSize="9" fontFamily="system-ui">
            {['+18.2M', '+11.5M', '+7.9M', '+5.1M'][row]}
          </text>
        </g>
      ))}
    </svg>
  )
}

function SupplyChainIllustration() {
  return (
    <svg viewBox="0 0 320 120" className="w-full h-auto" aria-hidden>
      <rect width="320" height="120" fill="#0d1117" rx="6" />
      <circle cx="160" cy="24" r="10" fill="#4a9eff" opacity="0.25" stroke="#4a9eff" strokeWidth="1.5" />
      <text x="160" y="28" textAnchor="middle" fill="#4a9eff" fontSize="7" fontFamily="system-ui">
        Item
      </text>
      {[
        { x: 80, label: 'Build', profit: '+2.1M', good: true },
        { x: 240, label: 'Buy', profit: '+1.4M', good: false },
      ].map(({ x, label, profit, good }) => (
        <g key={label}>
          <line x1="160" y1="34" x2={x} y2="52" stroke="#30363d" strokeWidth="1.5" />
          <rect x={x - 36} y="52" width="72" height="28" fill="#161b22" rx="4" stroke="#30363d" />
          <text x={x} y="66" textAnchor="middle" fill="#e6edf3" fontSize="8" fontFamily="system-ui">
            {label}
          </text>
          <text
            x={x}
            y="76"
            textAnchor="middle"
            fill={good ? '#3fb950' : '#8b949e'}
            fontSize="8"
            fontFamily="system-ui"
          >
            {profit}
          </text>
        </g>
      ))}
      <rect x="8" y="92" width="304" height="20" fill="#161b22" rx="4" />
      <text x="16" y="105" fill="#8b949e" fontSize="8" fontFamily="system-ui">
        Shopping list · 14 materials · export CSV
      </text>
    </svg>
  )
}

function StationIllustration() {
  const hubs = [
    { name: 'Jita', w: 92, profit: '+18.2M' },
    { name: 'Amarr', w: 68, profit: '+14.1M' },
    { name: 'Dodixie', w: 45, profit: '+9.8M' },
    { name: 'Rens', w: 32, profit: '+6.2M' },
  ]
  return (
    <svg viewBox="0 0 320 120" className="w-full h-auto" aria-hidden>
      <rect width="320" height="120" fill="#0d1117" rx="6" />
      {hubs.map((hub, i) => (
        <g key={hub.name}>
          <text x="12" y={28 + i * 24} fill="#8b949e" fontSize="8" fontFamily="system-ui">
            {hub.name}
          </text>
          <rect x="52" y={16 + i * 24} width="200" height="16" fill="#161b22" rx="3" />
          <rect
            x="52"
            y={16 + i * 24}
            width={hub.w * 2}
            height="16"
            fill={i === 0 ? '#58a6ff' : '#30363d'}
            opacity={i === 0 ? 0.8 : 0.6}
            rx="3"
          />
          <text x="260" y={28 + i * 24} fill={i === 0 ? '#58a6ff' : '#e6edf3'} fontSize="8" fontFamily="system-ui">
            {hub.profit}
          </text>
        </g>
      ))}
    </svg>
  )
}

function AccountIllustration() {
  return (
    <svg viewBox="0 0 320 120" className="w-full h-auto" aria-hidden>
      <rect width="320" height="120" fill="#0d1117" rx="6" />
      <rect x="8" y="8" width="148" height="50" fill="#161b22" rx="4" stroke="#30363d" />
      <circle cx="28" cy="28" r="8" fill="#3fb950" opacity="0.3" />
      <text x="42" y="26" fill="#e6edf3" fontSize="9" fontWeight="600" fontFamily="system-ui">
        Industry Alt
      </text>
      <text x="42" y="38" fill="#3fb950" fontSize="10" fontWeight="600" fontFamily="system-ui">
        2.4B ISK
      </text>
      <text x="42" y="50" fill="#8b949e" fontSize="7" fontFamily="system-ui">
        Goal: 5.0B · 48%
      </text>
      <rect x="164" y="8" width="148" height="50" fill="#161b22" rx="4" stroke="#30363d" />
      <text x="176" y="24" fill="#8b949e" fontSize="7" fontFamily="system-ui">
        Active jobs
      </text>
      <text x="176" y="40" fill="#e6edf3" fontSize="9" fontFamily="system-ui">
        3 running · 1 queued
      </text>
      <text x="176" y="52" fill="#f5a623" fontSize="7" fontFamily="system-ui">
        Research timer: 14h 22m
      </text>
      <rect x="8" y="66" width="98" height="46" fill="#161b22" rx="4" />
      <text x="16" y="82" fill="#8b949e" fontSize="7" fontFamily="system-ui">
        Minerals
      </text>
      <text x="16" y="98" fill="#e6edf3" fontSize="8" fontFamily="system-ui">
        Trit · Pyer · Mex
      </text>
      <rect x="114" y="66" width="98" height="46" fill="#161b22" rx="4" />
      <text x="122" y="82" fill="#8b949e" fontSize="7" fontFamily="system-ui">
        Sell orders
      </text>
      <text x="122" y="98" fill="#e6edf3" fontSize="8" fontFamily="system-ui">
        6 listed
      </text>
      <rect x="220" y="66" width="92" height="46" fill="#161b22" rx="4" />
      <text x="228" y="82" fill="#8b949e" fontSize="7" fontFamily="system-ui">
        Characters
      </text>
      <text x="228" y="98" fill="#e6edf3" fontSize="8" fontFamily="system-ui">
        + add alt
      </text>
    </svg>
  )
}

function ProgressionIllustration() {
  const skills = [
    { name: 'Industry V', done: true },
    { name: 'Mass Prod IV', done: true },
    { name: 'Adv Industry III', done: false, active: true },
    { name: 'Metallurgy II', done: false },
  ]
  return (
    <svg viewBox="0 0 320 120" className="w-full h-auto" aria-hidden>
      <rect width="320" height="120" fill="#0d1117" rx="6" />
      {skills.map((skill, i) => (
        <g key={skill.name}>
          <circle
            cx="24"
            cy={22 + i * 24}
            r="6"
            fill={skill.done ? '#3fb950' : skill.active ? '#f5a623' : '#21262d'}
            stroke={skill.active ? '#f5a623' : '#30363d'}
            strokeWidth="1.5"
          />
          {skill.done && (
            <path
              d={`M21 ${22 + i * 24} L23 ${24 + i * 24} L27 ${20 + i * 24}`}
              fill="none"
              stroke="#0d1117"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          )}
          {i < skills.length - 1 && (
            <line
              x1="24"
              y1={28 + i * 24}
              x2="24"
              y2={40 + i * 24}
              stroke={skill.done ? '#3fb950' : '#30363d'}
              strokeWidth="1.5"
              opacity="0.6"
            />
          )}
          <text
            x="40"
            y={25 + i * 24}
            fill={skill.active ? '#f5a623' : '#e6edf3'}
            fontSize="9"
            fontWeight={skill.active ? 600 : 400}
            fontFamily="system-ui"
          >
            {skill.name}
          </text>
          {skill.active && (
            <text x="200" y={25 + i * 24} fill="#f5a623" fontSize="8" fontFamily="system-ui">
              ~4d 12h in queue
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

const FEATURES: FeatureDef[] = [
  {
    title: 'Blueprint rankings',
    tagline: 'Find the most profitable items to build right now.',
    highlights: ['Filter T1, T2 & Faction blueprints', 'Compare ME0 vs ME10 profit side by side', 'Sort by 1 day, 1 week, or 1 month trends'],
    accent: 'border-l-primary',
    illustration: <BlueprintIllustration />,
  },
  {
    title: 'Supply chains',
    tagline: 'See every material needed and whether to build or buy each part.',
    highlights: ['Recursive build tree for full production chains', 'Build vs buy profit at every step', 'Export a shopping list for market runs'],
    accent: 'border-l-secondary',
    illustration: <SupplyChainIllustration />,
  },
  {
    title: 'Station comparison',
    tagline: 'Pick the best hub to run your industry jobs.',
    highlights: ['Rank profits across Jita, Amarr, Dodixie, Rens & Hek', 'Factor in material costs per hub', 'Spot where margins are highest'],
    accent: 'border-l-info',
    illustration: <StationIllustration />,
  },
  {
    title: 'Account tracking',
    tagline: 'Keep your alts, ISK, and active industry organized.',
    highlights: ['Track ISK goals and wallet progress', 'Log minerals, sell orders & job slots', 'Monitor research timers across characters'],
    accent: 'border-l-success',
    illustration: <AccountIllustration />,
  },
  {
    title: 'Skill progression',
    tagline: 'Plan training paths that unlock better industry margins.',
    highlights: ['Follow recommended skill paths for your goals', 'See queue time estimates per level', 'Know exactly what to train next'],
    accent: 'border-l-warning',
    illustration: <ProgressionIllustration />,
  },
]

function FeatureCard({ feature, index }: { feature: FeatureDef; index: number }) {
  return (
    <article
      className={`rounded-lg border border-eve-border bg-base-300/30 border-l-4 ${feature.accent} overflow-hidden`}
    >
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-base-100 text-xs font-bold text-primary border border-eve-border">
            {index + 1}
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-base leading-tight">{feature.title}</h3>
            <p className="text-sm opacity-70 mt-1">{feature.tagline}</p>
          </div>
        </div>
      </div>
      <div className="px-4 pb-3">{feature.illustration}</div>
      <ul className="px-4 pb-4 space-y-1.5">
        {feature.highlights.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm opacity-85">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </article>
  )
}

export function OnboardingFeatureInfographic() {
  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="shrink-0">
        <h2 className="text-lg font-semibold">Welcome to EVE Industry Organizer</h2>
        <p className="text-sm opacity-70 mt-1">
          Your industry command center. No EVE login required. Scroll to explore each feature.
        </p>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-4 pr-1 -mr-1"
        aria-label="App features overview"
      >
        {FEATURES.map((feature, i) => (
          <FeatureCard key={feature.title} feature={feature} index={i} />
        ))}

        <div className="rounded-lg border border-dashed border-eve-border bg-base-300/20 px-4 py-3 flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0 text-secondary" aria-hidden>
            <path
              d="M12 2 L20 6 V12 C20 17 16 21 12 22 C8 21 4 17 4 12 V6 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M9 12 L11 14 L15 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="text-sm opacity-80">
            Enter your skills manually during setup for accurate numbers. Optional Google Drive sync
            is available later in Settings.
          </p>
        </div>
      </div>
    </div>
  )
}
