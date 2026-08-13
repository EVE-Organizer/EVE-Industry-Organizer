import { groupFitSkills, romanLevel } from '@/lib/fitting/skillDisplay'
import type { FitSkillRow } from '@/lib/fitting/types'

export function FitSkillsTable({ rows }: { rows: FitSkillRow[] }) {
  const groups = groupFitSkills(rows)
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Skill</th>
            <th>Need</th>
            <th>Trained</th>
            <th>Status</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.title}>
            <tr>
              <th colSpan={4} className="bg-base-300 text-xs font-medium uppercase tracking-wide">
                {group.title}
              </th>
            </tr>
            {group.rows.map((row) => {
              const have = row.trained ?? 0
              const short = have < row.required
              return (
                <tr key={row.skillId} className={short ? 'text-error' : 'text-success'}>
                  <td>{row.name}</td>
                  <td>{romanLevel(row.required)}</td>
                  <td>{romanLevel(have)}</td>
                  <td>{short ? 'Missing' : 'Ok'}</td>
                </tr>
              )
            })}
          </tbody>
        ))}
      </table>
    </div>
  )
}
