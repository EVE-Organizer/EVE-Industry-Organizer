import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { createCharacter } from '@/services/sync/types'
import type { CharacterAccount, ResearchTimer, RunningJob, SellOrder } from '@/types'
import { Panel } from '@/components/Panel'
import { StatCard } from '@/components/StatCard'
import { PageHeader, formatIsk } from '@/components/Layout'
import { CharacterAvatar, EveImage, IskBadge } from '@/components/EveImage'
import { BpoImage, DEFAULT_BPO_TYPE_ID } from '@/components/BpoImage'
import { MetricTile } from '@/components/MetricTile'
import { MINERAL_KEYS } from '@/lib/eveImages'
import { MINERAL_TYPE_IDS } from '@/types'

export function AccountsPage() {
  const userData = useAppStore((s) => s.userData)
  const addAccount = useAppStore((s) => s.addAccount)
  const updateAccount = useAppStore((s) => s.updateAccount)
  const removeAccount = useAppStore((s) => s.removeAccount)
  const [selectedId, setSelectedId] = useState(userData.accounts[0]?.id ?? '')

  const account = userData.accounts.find((a) => a.id === selectedId)

  const addChar = () => {
    const c = createCharacter(`Alt ${userData.accounts.length + 1}`)
    addAccount(c)
    setSelectedId(c.id)
  }

  if (!account && userData.accounts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <PageHeader title="Accounts" subtitle="No characters yet" />
        <EveImage id={3380} size={64} framed alt="" />
        <button className="btn btn-primary" onClick={addChar}>
          Add character
        </button>
      </div>
    )
  }

  const iskProgress = account && account.iskGoal > 0
    ? Math.min(100, (account.iskCurrent / account.iskGoal) * 100)
    : 0

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Track characters, BPOs, jobs, stockpile, and sell orders"
        action={
          <button className="btn btn-primary btn-sm" onClick={addChar}>
            Add character
          </button>
        }
      />

      <div className="tabs tabs-boxed mb-4 flex-wrap bg-base-200/80">
        {userData.accounts.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`tab gap-2 ${selectedId === a.id ? 'tab-active' : ''}`}
            onClick={() => setSelectedId(a.id)}
          >
            <CharacterAvatar name={a.name} size={24} isOmega={a.isOmega} />
            <span className="truncate max-w-[8rem]">{a.name}</span>
          </button>
        ))}
      </div>

      {account && (
        <>
          <section className="infographic-hero mb-6 p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <CharacterAvatar name={account.name} size={72} isOmega={account.isOmega} />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold">{account.name}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  <MetricTile
                    label="Wallet"
                    value={formatIsk(account.iskCurrent)}
                    accent="warning"
                    icon={<IskBadge className="!w-7 !h-7 !text-xs" />}
                  />
                  <MetricTile
                    label="Jobs"
                    value={account.runningJobs.length}
                    accent="success"
                    icon={<BpoImage blueprintTypeId={DEFAULT_BPO_TYPE_ID} size={32} />}
                  />
                  <MetricTile
                    label="Research"
                    value={account.researchTimers.length}
                    accent="info"
                    icon={<EveImage id={3406} size={28} framed alt="" />}
                  />
                  <MetricTile
                    label="Sell orders"
                    value={account.sellOrders.length}
                    accent="secondary"
                    icon={<EveImage id={16652} size={28} framed alt="" />}
                  />
                </div>
                <div className="mt-3 max-w-md">
                  <div className="flex justify-between text-xs mb-1 opacity-70">
                    <span>ISK goal progress</span>
                    <span>{iskProgress.toFixed(0)}%</span>
                  </div>
                  <progress className="progress progress-warning w-full h-2" value={iskProgress} max={100} />
                </div>
              </div>
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-4">
            <AccountOverview account={account} onUpdate={(p) => updateAccount(account.id, p)} />
            <MineralStock account={account} onUpdate={(p) => updateAccount(account.id, p)} />
            <SellOrders account={account} onUpdate={(p) => updateAccount(account.id, p)} />
            <ResearchTimers account={account} onUpdate={(p) => updateAccount(account.id, p)} />
            <RunningJobs account={account} onUpdate={(p) => updateAccount(account.id, p)} />
            <div className="lg:col-span-2">
              <button className="btn btn-error btn-outline btn-sm" onClick={() => removeAccount(account.id)}>
                Remove {account.name}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AccountOverview({
  account,
  onUpdate,
}: {
  account: CharacterAccount
  onUpdate: (p: Partial<CharacterAccount>) => void
}) {
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <CharacterAvatar name={account.name} size={28} isOmega={account.isOmega} />
          Overview
        </span>
      }
    >
      <label className="form-control">
        <span className="label-text">Name</span>
        <input
          className="input input-bordered input-sm"
          value={account.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="form-control">
          <span className="label-text flex items-center gap-1">
            <IskBadge className="!w-4 !h-4 !text-[10px]" />
            Current ISK
          </span>
          <input
            type="number"
            className="input input-bordered input-sm"
            value={account.iskCurrent}
            onChange={(e) => onUpdate({ iskCurrent: +e.target.value })}
          />
        </label>
        <label className="form-control">
          <span className="label-text">ISK goal</span>
          <input
            type="number"
            className="input input-bordered input-sm"
            value={account.iskGoal}
            onChange={(e) => onUpdate({ iskGoal: +e.target.value })}
          />
        </label>
      </div>
      <StatCard
        label="Progress"
        value={`${account.iskGoal > 0 ? ((account.iskCurrent / account.iskGoal) * 100).toFixed(0) : 0}%`}
        description={`${formatIsk(account.iskCurrent)} / ${formatIsk(account.iskGoal)}`}
        valueClassName="text-warning text-xl"
        className="mt-2 !p-3"
        accent="warning"
        icon={<IskBadge />}
      />
      <label className="label cursor-pointer justify-start gap-2 mt-2">
        <input
          type="checkbox"
          className="checkbox checkbox-sm checkbox-warning"
          checked={account.isOmega}
          onChange={(e) => onUpdate({ isOmega: e.target.checked })}
        />
        <span className="label-text flex items-center gap-1">
          Omega clone
          <span className="badge badge-warning badge-xs">Ω</span>
        </span>
      </label>
    </Panel>
  )
}

function MineralStock({
  account,
  onUpdate,
}: {
  account: CharacterAccount
  onUpdate: (p: Partial<CharacterAccount>) => void
}) {
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <EveImage id={34} size={24} framed alt="" />
          Mineral stockpile
        </span>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {MINERAL_KEYS.map((k) => (
          <label key={k} className="form-control">
            <span className="label-text text-xs capitalize flex items-center gap-1.5">
              <EveImage id={MINERAL_TYPE_IDS[k]} size={32} alt={k} />
              {k}
            </span>
            <input
              type="number"
              className="input input-bordered input-sm"
              value={account.mineralStock[k]}
              onChange={(e) =>
                onUpdate({ mineralStock: { ...account.mineralStock, [k]: +e.target.value } })
              }
            />
          </label>
        ))}
      </div>
    </Panel>
  )
}

function SellOrders({
  account,
  onUpdate,
}: {
  account: CharacterAccount
  onUpdate: (p: Partial<CharacterAccount>) => void
}) {
  const add = () => {
    const order: SellOrder = {
      id: crypto.randomUUID(),
      itemName: '',
      quantity: 0,
      price: 0,
      expiry: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    }
    onUpdate({ sellOrders: [...account.sellOrders, order] })
  }

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <EveImage id={16652} size={24} framed alt="" />
          Sell orders
        </span>
      }
      actions={
        <button type="button" className="btn btn-ghost btn-xs" onClick={add}>
          Add
        </button>
      }
    >
      {account.sellOrders.length === 0 && (
        <p className="text-xs opacity-50 py-2">No sell orders yet.</p>
      )}
      {account.sellOrders.map((o) => (
        <div key={o.id} className="flex items-center gap-2 mb-2">
          <EveImage id={16652} size={24} alt="" className="opacity-60" />
          <div className="grid grid-cols-2 gap-1 flex-1 text-xs min-w-0">
            <input
              placeholder="Item"
              className="input input-bordered input-xs"
              value={o.itemName}
              onChange={(e) =>
                onUpdate({
                  sellOrders: account.sellOrders.map((x) =>
                    x.id === o.id ? { ...x, itemName: e.target.value } : x,
                  ),
                })
              }
            />
            <input
              type="number"
              placeholder="Qty"
              className="input input-bordered input-xs"
              value={o.quantity || ''}
              onChange={(e) =>
                onUpdate({
                  sellOrders: account.sellOrders.map((x) =>
                    x.id === o.id ? { ...x, quantity: +e.target.value } : x,
                  ),
                })
              }
            />
          </div>
        </div>
      ))}
    </Panel>
  )
}

function ResearchTimers({
  account,
  onUpdate,
}: {
  account: CharacterAccount
  onUpdate: (p: Partial<CharacterAccount>) => void
}) {
  const add = () => {
    const timer: ResearchTimer = {
      id: crypto.randomUUID(),
      blueprintTypeId: DEFAULT_BPO_TYPE_ID,
      type: 'me',
      targetLevel: 1,
      endDate: new Date(Date.now() + 86400000).toISOString(),
    }
    onUpdate({ researchTimers: [...account.researchTimers, timer] })
  }

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <EveImage id={3406} size={24} framed alt="" />
          Research timers
        </span>
      }
      actions={
        <button type="button" className="btn btn-ghost btn-xs" onClick={add}>
          Add
        </button>
      }
    >
      {account.researchTimers.map((t) => (
        <div key={t.id} className="text-xs py-2 flex items-center gap-2 border-b border-eve-border/30 last:border-0 min-w-0">
          <BpoImage blueprintTypeId={t.blueprintTypeId} size={32} />
          <span className="shrink-0 font-medium">
            {t.type.toUpperCase()} to {t.targetLevel}
          </span>
          <input
            type="datetime-local"
            className="input input-bordered input-xs min-w-0 flex-1"
            value={t.endDate.slice(0, 16)}
            onChange={(e) =>
              onUpdate({
                researchTimers: account.researchTimers.map((x) =>
                  x.id === t.id ? { ...x, endDate: new Date(e.target.value).toISOString() } : x,
                ),
              })
            }
          />
        </div>
      ))}
    </Panel>
  )
}

function RunningJobs({
  account,
  onUpdate,
}: {
  account: CharacterAccount
  onUpdate: (p: Partial<CharacterAccount>) => void
}) {
  const add = () => {
    const job: RunningJob = {
      id: crypto.randomUUID(),
      blueprintTypeId: DEFAULT_BPO_TYPE_ID,
      runs: 100,
      endDate: new Date(Date.now() + 3600000).toISOString(),
    }
    onUpdate({ runningJobs: [...account.runningJobs, job] })
  }

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <BpoImage blueprintTypeId={688} size={32} />
          Running jobs
        </span>
      }
      actions={
        <button type="button" className="btn btn-ghost btn-xs" onClick={add}>
          Add
        </button>
      }
    >
      {account.runningJobs.map((j) => (
        <div key={j.id} className="text-xs py-2 flex items-center gap-2 border-b border-eve-border/30 last:border-0">
          <BpoImage blueprintTypeId={j.blueprintTypeId} size={32} />
          <div className="min-w-0">
            <p className="font-medium">{j.runs} runs</p>
            <p className="opacity-60 truncate">Ends {new Date(j.endDate).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </Panel>
  )
}
