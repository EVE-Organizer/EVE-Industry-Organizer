import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GlobalSettings, CharacterAccount } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'
import { GlobalSettingsForm } from '@/components/GlobalSettingsForm'
import { SkillLevelSlider } from '@/components/SkillLevelSlider'
import { ONBOARDING_SKILL_FIELDS } from '@/lib/skillFields'
import { OnboardingFeatureInfographic } from '@/components/OnboardingFeatureInfographic'
import { createCharacter } from '@/services/sync/types'
import { useAppStore } from '@/stores/appStore'

const TOTAL_STEPS = 4

const STEP_LABELS = ['Welcome', 'Global defaults', 'First character', 'Review'] as const

export function OnboardingPage() {
  const navigate = useNavigate()
  const completeOnboarding = useAppStore((s) => s.completeOnboarding)
  const [step, setStep] = useState(0)
  const [settings, setSettings] = useState<GlobalSettings>({ ...DEFAULT_SETTINGS })
  const [charName, setCharName] = useState('')
  const [isOmega, setIsOmega] = useState(true)
  const [skills, setSkills] = useState<Partial<CharacterAccount['skills']>>({})

  const finish = () => {
    const character = createCharacter(charName, skills)
    character.isOmega = isOmega
    completeOnboarding(settings, character)
    navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-base-100">
      <div
        className="card bg-base-200 w-full max-w-2xl max-h-[calc(100dvh-2rem)] shadow-xl border border-eve-border overflow-hidden flex flex-col min-h-0"
        style={
          {
            '--onboarding-header': '8.5rem',
            '--onboarding-actions': '4.5rem',
          } as React.CSSProperties
        }
      >
        <header className="bg-base-300/40 px-6 py-4 border-b border-eve-border shrink-0">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <p className="text-sm font-medium text-primary">{STEP_LABELS[step]}</p>
            <span className="text-xs opacity-60 shrink-0">
              Step {step + 1} of {TOTAL_STEPS}
            </span>
          </div>
          <progress
            className="progress progress-primary h-2"
            value={step + 1}
            max={TOTAL_STEPS}
          />
          <div className="mt-3 flex justify-between gap-1">
            {STEP_LABELS.map((label, i) => (
              <div
                key={label}
                className={`flex-1 min-w-0 text-center text-[10px] leading-tight ${
                  i === step
                    ? 'text-primary font-medium'
                    : i < step
                      ? 'opacity-70'
                      : 'opacity-40'
                }`}
              >
                <span
                  className={`mx-auto mb-1 block h-1.5 w-1.5 rounded-full ${
                    i <= step ? 'bg-primary' : 'bg-base-content/20'
                  }`}
                  aria-hidden
                />
                {label}
              </div>
            ))}
          </div>
        </header>

        <div className="card-body flex flex-col flex-1 min-h-0">
          <div
            className={`flex flex-col flex-1 min-h-0 h-[calc(100dvh-var(--onboarding-header)-var(--onboarding-actions)-2rem)] min-h-[16rem] ${
              step === 0 ? 'overflow-hidden' : 'overflow-y-auto scrollbar-thin'
            }`}
          >
            {step === 0 && <OnboardingFeatureInfographic />}

            {step === 1 && (
              <GlobalSettingsForm
                settings={settings}
                onChange={(patch) => setSettings({ ...settings, ...patch })}
              />
            )}

            {step === 2 && (
              <div className="flex flex-col gap-3 min-h-0 flex-1">
                <label className="form-control shrink-0">
                  <span className="label-text">Character name *</span>
                  <input
                    className="input input-bordered"
                    value={charName}
                    onChange={(e) => setCharName(e.target.value)}
                    placeholder="e.g. Industry Alt"
                    autoFocus
                  />
                </label>
                <label className="label cursor-pointer justify-start gap-3 shrink-0">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={isOmega}
                    onChange={(e) => setIsOmega(e.target.checked)}
                  />
                  <span>Omega clone</span>
                </label>
                <p className="text-xs opacity-60 shrink-0">
                  Optional skill levels: drag the slider from 0 to V.
                </p>
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1 -mr-1">
                  {ONBOARDING_SKILL_FIELDS.map(({ key, skillId, label }) => (
                    <SkillLevelSlider
                      key={key}
                      skillId={skillId}
                      label={label}
                      value={skills[key] ?? 0}
                      onChange={(level) => setSkills({ ...skills, [key]: level })}
                    />
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <ul className="text-sm space-y-1 opacity-90">
                <li>Hub: {settings.primaryHub}</li>
                <li>
                  ME {settings.meDefault} / TE {settings.teDefault} · Batch {settings.batchSize}
                </li>
                <li>
                  Tax: {settings.brokerFeePercent}% broker · {settings.salesTaxPercent}% sales
                </li>
                <li>
                  Character: {charName} ({isOmega ? 'Omega' : 'Alpha'})
                </li>
              </ul>
            )}
          </div>

          <div
            className={`card-actions mt-4 pt-4 border-t border-eve-border shrink-0 ${
              step === 0 ? 'justify-end' : 'justify-between'
            }`}
          >
            {step > 0 && (
              <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            {step === 0 && (
              <button className="btn btn-primary" onClick={() => setStep(1)}>
                Get started
              </button>
            )}
            {step === 1 && (
              <button className="btn btn-primary" onClick={() => setStep(2)}>
                Next
              </button>
            )}
            {step === 2 && (
              <button
                className="btn btn-primary"
                disabled={!charName.trim()}
                onClick={() => setStep(3)}
              >
                Next
              </button>
            )}
            {step === 3 && (
              <button className="btn btn-primary" onClick={finish}>
                Finish setup
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
