import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getStoredCharacters } from '@/services/auth/eveAuth'
import { useAuthStore } from '@/stores/authStore'

/** Survives React Strict Mode remount so we only exchange each auth code once. */
const processedAuthCodes = new Set<string>()

function waitForCharacters(timeoutMs = 30_000): Promise<boolean> {
  return new Promise((resolve) => {
    if (getStoredCharacters().length > 0) {
      resolve(true)
      return
    }

    const started = Date.now()
    const pollId = window.setInterval(() => {
      if (getStoredCharacters().length > 0) {
        window.clearInterval(pollId)
        resolve(true)
        return
      }
      if (Date.now() - started >= timeoutMs) {
        window.clearInterval(pollId)
        resolve(false)
      }
    }, 250)
  })
}

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const completeCallback = useAuthStore((s) => s.completeCallback)
  const error = useAuthStore((s) => s.error)
  const [localError, setLocalError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle')

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const ssoError = searchParams.get('error')
    const ssoDescription = searchParams.get('error_description')

    if (ssoError) {
      setLocalError(ssoDescription ?? ssoError)
      return
    }

    if (!code || !state) {
      setLocalError('Missing authorization code')
      return
    }

    const authCode = code
    const authState = state

    let cancelled = false

    async function finishSignIn() {
      setStatus('done')
      navigate('/settings', { replace: true })
    }

    async function run() {
      setStatus('working')

      if (processedAuthCodes.has(authCode)) {
        const signedIn = await waitForCharacters()
        if (cancelled) return
        if (signedIn) {
          await finishSignIn()
        } else {
          setLocalError('Sign-in is taking too long. Try again from Settings.')
        }
        return
      }

      processedAuthCodes.add(authCode)

      try {
        await completeCallback(authCode, authState)
        if (cancelled) {
          // Strict Mode unmount: auth may still have succeeded; redirect anyway.
          if (getStoredCharacters().length > 0) {
            navigate('/settings', { replace: true })
          }
          return
        }
        await finishSignIn()
      } catch (err) {
        if (cancelled) return
        processedAuthCodes.delete(authCode)
        setLocalError(err instanceof Error ? err.message : 'Sign-in failed')
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [searchParams, completeCallback, navigate])

  const message = localError ?? error

  if (message) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-error text-sm max-w-md text-center">{message}</p>
        <Link to="/settings" className="btn btn-primary btn-sm">
          Back to settings
        </Link>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="text-sm opacity-70">Redirecting…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
      <span className="loading loading-spinner loading-lg text-primary" />
      <p className="text-sm opacity-70">Signing in with EVE Online…</p>
    </div>
  )
}
