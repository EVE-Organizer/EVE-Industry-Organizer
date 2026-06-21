import { Link } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { useSdeData } from '@/hooks/useSdeData'
import { buildTypeMap } from '@/services/data/sdeLoader'
import { Panel } from '@/components/Panel'
import { StatCard } from '@/components/StatCard'
import { EveImage, CharacterAvatar, HubLogo, IskBadge } from '@/components/EveImage'
import { PageHeader, LoadingState, formatIsk } from '@/components/Layout'
import { formatNumber } from '@/lib/profit'
import { NAV_TYPE_IDS } from '@/lib/eveImages'

const QUICK_LINKS = [
  { to: '/blueprints', label: 'Blueprints', typeId: NAV_TYPE_IDS.blueprints, desc: 'Profit rankings' },
  { to: '/stations', label: 'Stations', hubId: 'jita' as const, desc: 'Hub comparison' },
  { to: '/accounts', label: 'Accounts', typeId: NAV_TYPE_IDS.accounts, desc: 'Characters & stock' },
  { to: '/progression', label: 'Progression', typeId: NAV_TYPE_IDS.progression, desc: 'Skill paths' },
]

export function DashboardPage() {
  const userData = useAppStore((s) => s.userData)
  const { data: sde, isLoading } = useSdeData()
  const account = userData.accounts[0]
  const typeMap = sde ? buildTypeMap(sde.types) : new Map()

  const needsSkills = account && account.skills.industry === 0 && account.skills.accounting === 0
  const iskProgress = account && account.iskGoal > 0
    ? Math.min(100, (account.iskCurrent / account.iskGoal) * 100)
    : 0

  if (isLoading) return <LoadingState />

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Industry overview and watchlist"
      />

      {needsSkills && (
        <div className="alert alert-warning mb-4 text-sm">
          <EveImage id={3380} size={24} framed alt="" />
          <span>Skill levels are at default. Update them in Accounts for accurate calculations.</span>
        </div>
      )}

      {account && (
        <section className="infographic-hero mb-6 p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <CharacterAvatar name={account.name} size={64} isOmega={account.isOmega} />
            <div className="flex-1 min-w-0 w-full">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-xl font-bold truncate">{account.name}</h2>
                {account.isOmega && <span className="badge badge-warning badge-sm">Omega</span>}
              </div>
              <p className="text-sm opacity-70 mb-3">Primary character overview</p>
              <div className="flex flex-wrap items-center gap-3 text-sm mb-2">
                <span className="flex items-center gap-1.5 font-semibold text-secondary">
                  <IskBadge className="!w-5 !h-5 !text-xs" />
                  {formatIsk(account.iskCurrent)}
                </span>
                <span className="opacity-50">/</span>
                <span className="opacity-70">Goal {formatIsk(account.iskGoal)}</span>
              </div>
              <progress className="progress progress-warning w-full max-w-md h-2" value={iskProgress} max={100} />
              <p className="text-xs opacity-60 mt-1">{formatNumber(iskProgress, 0)}% toward goal</p>
            </div>
            <div className="hidden md:block shrink-0 opacity-80">
              <EveImage id={NAV_TYPE_IDS.dashboard} size={64} framed alt="" />
            </div>
          </div>
        </section>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Characters"
          value={userData.accounts.length}
          valueClassName="text-primary text-2xl"
          accent="primary"
          icon={
            userData.accounts.length > 0 ? (
              <div className="flex -space-x-2">
                {userData.accounts.slice(0, 3).map((a) => (
                  <CharacterAvatar key={a.id} name={a.name} size={28} />
                ))}
              </div>
            ) : (
              <EveImage id={3380} size={32} framed alt="" />
            )
          }
        />
        {account && (
          <>
            <StatCard
              label={`${account.name} ISK`}
              value={formatIsk(account.iskCurrent)}
              description={`Goal: ${formatIsk(account.iskGoal)}`}
              valueClassName="text-secondary text-2xl"
              accent="secondary"
              icon={<IskBadge />}
            />
            <StatCard
              label="Running jobs"
              value={account.runningJobs.length}
              accent="success"
              icon={<EveImage id={688} variant="bp" productTypeId={12753} size={32} framed alt="" />}
            />
          </>
        )}
      </div>

      <Panel title="Watchlist" titleClassName="text-lg">
        {userData.watchlist.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <EveImage id={688} variant="bp" productTypeId={12753} size={32} framed alt="" />
            <p className="text-sm opacity-60">Pin blueprints from the Blueprints page.</p>
            <Link to="/blueprints" className="btn btn-primary btn-sm">
              Browse blueprints
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-eve-border/50">
            {userData.watchlist.map((w) => {
              const type = typeMap.get(w.productTypeId)
              return (
                <li key={w.productTypeId} className="watchlist-row">
                  <EveImage
                    id={w.productTypeId}
                    size={32}
                    framed
                    alt={type?.name ?? 'Item'}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{type?.name ?? `Type ${w.productTypeId}`}</p>
                    {type?.group && <p className="text-xs opacity-50">{type.group}</p>}
                  </div>
                  <Link className="btn btn-ghost btn-xs shrink-0" to={`/blueprints/${w.productTypeId}`}>
                    View
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60 mb-3">Quick navigation</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="infographic-nav-tile">
              {'hubId' in link && link.hubId ? (
                <HubLogo hubId={link.hubId} size={32} alt={link.label} />
              ) : (
                <EveImage id={link.typeId!} size={32} framed alt="" />
              )}
              <span className="font-semibold text-sm">{link.label}</span>
              <span className="text-xs opacity-60">{link.desc}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
