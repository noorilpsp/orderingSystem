'use client'

import type React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Link } from '@/components/ui/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { resetPassword } from '@/app/actions/auth'

export default function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Exchange code from URL when component mounts
  useEffect(() => {
    if (typeof window === 'undefined') return

    const exchangeCode = async () => {
      // Check for code in query params (Supabase PKCE flow)
      const code = searchParams.get('code')

      if (code) {
        try {
          const res = await fetch('/api/auth/exchange-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
            credentials: 'include',
          })

          const data = await res.json().catch(() => ({} as any))

          if (res.ok) {
            // Code exchanged successfully, session is now set
            // Remove code from URL
            const url = new URL(window.location.href)
            url.searchParams.delete('code')
            window.history.replaceState(null, '', url.pathname + url.search)
          } else {
            setError(data.message || 'Invalid or expired reset link. Please request a new password reset.')
          }
        } catch (err) {
          setError('Failed to validate reset link. Please request a new password reset.')
        }
      } else {
        // Check if we already have a session (code was already exchanged)
        try {
          const sessionRes = await fetch('/api/auth/check-session', {
            method: 'GET',
            credentials: 'include',
          })
          
          if (!sessionRes.ok) {
            setError('Invalid or expired reset link. Please request a new password reset.')
          }
        } catch (err) {
          // Session check failed
        }
      }
    }

    exchangeCode()
  }, [searchParams])

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
    if (error) setError(null)
    if (passwordError) setPasswordError(null)
  }

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value)
    if (error) setError(null)
    if (passwordError) setPasswordError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate passwords
    if (!password || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters long')
      return
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    // Allow submission even if tokens aren't exchanged yet
    // The API will verify the session

    setLoading(true)
    setError(null)
    setPasswordError(null)

    try {
      // Check if we have a code that needs to be exchanged first
      const code = searchParams.get('code')
      
      if (code) {
        // Exchange code first
        const codeRes = await fetch('/api/auth/exchange-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
          credentials: 'include',
        })

        if (!codeRes.ok) {
          const codeData = await codeRes.json().catch(() => ({} as any))
          throw new Error(codeData.message || 'Invalid or expired reset link. Please request a new password reset.')
        }
      }

      // Call Server Action directly - no fetch needed!
      const result = await resetPassword({ password })

      if (result.error) {
        throw new Error(result.error)
      }

      setSuccess(true)
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/staff/login')
      }, 2000)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-2xl">
        <div className="p-6 sm:p-12 sm:shadow-xl sm:border sm:border-border/40 sm:bg-card sm:rounded-3xl">
          <div className="space-y-8">
            {/* Logo */}
            <div className="flex justify-center">
              <div className="w-28 h-28 relative">
                <Image
                  src="/BSVG.svg"
                  alt="BerryTap Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            <div className="text-center space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Staff</p>
              <h1 className="text-3xl font-semibold tracking-tight text-balance text-foreground">
                Password reset successful
              </h1>
              <p className="text-muted-foreground">
                Your password has been reset successfully. Redirecting to sign in...
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="p-6 sm:p-12 sm:shadow-xl sm:border sm:border-border/40 sm:bg-card sm:rounded-3xl">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="w-28 h-28 relative">
              <Image
                src="/BSVG.svg"
                alt="BerryTap Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">Staff</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance text-foreground">
              Set new password
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter a new password for your staff account
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          {passwordError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {passwordError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-0">
            <div className="space-y-0">
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  placeholder=""
                  value={password}
                  onChange={handlePasswordChange}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  required
                  className={`w-full h-14 px-4 pr-14 pt-5 pb-1 text-base bg-background border transition-all text-foreground focus:outline-none focus:ring-0 ${
                    passwordError
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-border/50 focus:border-blue-500'
                  } ${confirmPassword ? 'rounded-t-xl border-b-0' : 'rounded-xl'}`}
                />
                <label
                  htmlFor="password"
                  className={`absolute left-4 transition-all pointer-events-none ${
                    passwordFocused || password.length > 0
                      ? 'top-2 text-xs text-muted-foreground'
                      : 'top-1/2 -translate-y-1/2 text-base text-muted-foreground/60'
                  }`}
                >
                  New Password
                </label>
              </div>

              {password && (
                <div className="relative animate-in fade-in slide-in-from-top-2 duration-300">
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder=""
                    value={confirmPassword}
                    onChange={handleConfirmPasswordChange}
                    onFocus={() => setConfirmPasswordFocused(true)}
                    onBlur={() => setConfirmPasswordFocused(false)}
                    required
                    className={`w-full h-14 px-4 pr-14 pt-5 pb-1 text-base bg-background border border-border/50 border-t-border/30 rounded-b-xl focus:border-blue-500 focus:outline-none focus:ring-0 transition-all text-foreground ${
                      passwordError ? 'border-red-500 focus:border-red-500' : ''
                    }`}
                  />
                  <label
                    htmlFor="confirmPassword"
                    className={`absolute left-4 transition-all pointer-events-none ${
                      confirmPasswordFocused || confirmPassword.length > 0
                        ? 'top-2 text-xs text-muted-foreground'
                        : 'top-1/2 -translate-y-1/2 text-base text-muted-foreground/60'
                    }`}
                  >
                    Confirm Password
                  </label>
                  <Button
                    type="submit"
                    disabled={password.length === 0 || confirmPassword.length === 0 || loading}
                    size="icon"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-border/30 hover:bg-border/50 text-foreground shadow-sm transition-all flex-shrink-0 ${
                      password.length === 0 || confirmPassword.length === 0 || loading
                        ? 'opacity-40 cursor-not-allowed'
                        : 'cursor-pointer'
                    }`}
                  >
                    <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                    <span className="sr-only">Submit</span>
                  </Button>
                </div>
              )}
            </div>
          </form>

          <div className="flex flex-col items-center gap-2 pt-6 text-sm">
            <Link
              href="/staff/login"
              className="text-blue-500 hover:text-blue-600 hover:underline transition-colors font-normal"
            >
              Back to sign in
            </Link>
          </div>

          {loading && (
            <p className="text-center text-sm text-muted-foreground pt-2">Resetting password…</p>
          )}
        </div>
      </div>
    </div>
  )
}

