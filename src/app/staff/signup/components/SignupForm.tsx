'use client'

import type React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Link } from '@/components/ui/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { signup } from '@/app/actions/auth'

export default function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [returnTo, setReturnTo] = useState<string | null>(null)
  const [invitationEmail, setInvitationEmail] = useState<string | null>(null)
  const [isEmailLocked, setIsEmailLocked] = useState(false)

  // Read returnTo and email from query params
  useEffect(() => {
    const returnToParam = searchParams.get('returnTo')
    const emailParam = searchParams.get('email')

    // Security: Only allow internal redirects (must start with /)
    if (returnToParam && returnToParam.startsWith('/')) {
      setReturnTo(returnToParam)
    } else if (returnToParam) {
      console.warn('[signup] Invalid returnTo URL, ignoring:', returnToParam)
    }

    // If email param exists, pre-fill and lock the email field
    if (emailParam) {
      const decodedEmail = decodeURIComponent(emailParam)
      setEmail(decodedEmail)
      setInvitationEmail(decodedEmail)
      setIsEmailLocked(true)
      // Auto-advance to password field since email is locked and valid
      setShowPassword(true)
    }
  }, [searchParams])

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // If email is locked (from invitation), prevent changes
    if (isEmailLocked) {
      return
    }

    const newEmail = e.target.value
    setEmail(newEmail)

    // Clear errors when user starts typing
    if (error) setError(null)
    if (emailError) setEmailError(null)

    if (newEmail.length === 0 && showPassword) {
      setShowPassword(false)
    }
  }

  const handleContinue = () => {
    if (!showPassword && email.length > 0) {
      // Basic email validation when user tries to continue
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        setEmailError('Please enter a valid email address')
        return
      }
      setShowPassword(true)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showPassword) {
      // first step advance (email -> password)
      handleContinue()
      return
    }

    // Validate required fields before submitting
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    // If invitation email exists, validate it matches
    if (invitationEmail && email.toLowerCase() !== invitationEmail.toLowerCase()) {
      setEmailError('Email must match the invitation email address')
      return
    }

    setLoading(true)
    setError(null)
    setEmailError(null)

    try {
      // Call Server Action directly - no fetch needed!
      const result = await signup({
        email,
        password,
        returnTo: returnTo || undefined,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      // Check if email confirmation is required
      if (!result.session) {
        // Email confirmation required
        setNeedsConfirmation(true)
        return
      }

      // Session exists, redirect to returnTo or default to dashboard
      const redirectUrl = returnTo || '/dashboard'
      window.location.href = redirectUrl
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

  if (needsConfirmation) {
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
                Check your email
              </h1>
              <p className="text-muted-foreground">
                We've sent a confirmation email to <strong>{email}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Click the link in the email to confirm your account and complete signup. If you don't see it, check your spam folder.
              </p>
            </div>

            <div className="flex flex-col items-center gap-2 pt-6 text-sm">
              <p className="text-muted-foreground">
                Already confirmed?{' '}
                <Link
                  href="/staff/login"
                  className="text-blue-500 hover:text-blue-600 hover:underline transition-colors font-normal"
                >
                  Sign in
                </Link>
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
          {/* v0 animated logo */}
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
              Create your BerryTap account
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              For merchants & restaurant staff
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          {emailError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {emailError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-0">
            <div className="space-y-0">
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  placeholder=""
                  value={email}
                  onChange={handleEmailChange}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  required
                  disabled={isEmailLocked}
                  className={`w-full h-14 px-4 pr-14 pt-5 pb-1 text-base bg-background border transition-all text-foreground focus:outline-none focus:ring-0 ${
                    emailError
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-border/50 focus:border-blue-500'
                  } ${showPassword ? 'rounded-t-xl border-b-0' : 'rounded-xl'} ${
                    isEmailLocked ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                />
                <label
                  htmlFor="email"
                  className={`absolute left-4 transition-all pointer-events-none ${
                    emailFocused || email.length > 0
                      ? 'top-2 text-xs text-muted-foreground'
                      : 'top-1/2 -translate-y-1/2 text-base text-muted-foreground/60'
                  }`}
                >
                  Email
                </label>
                {!showPassword && (
                  <Button
                    type="button"
                    onClick={handleContinue}
                    disabled={email.length === 0 || loading || !!emailError}
                    size="icon"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-border/30 hover:bg-border/50 text-foreground shadow-sm transition-all flex-shrink-0 ${
                      email.length === 0 || loading || !!emailError
                        ? 'opacity-40 cursor-not-allowed'
                        : 'cursor-pointer'
                    }`}
                  >
                    <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                    <span className="sr-only">Continue</span>
                  </Button>
                )}
              </div>
              {isEmailLocked && (
                <p className="text-xs text-muted-foreground mt-1 px-4">
                  This email address is from your invitation
                </p>
              )}

              {showPassword && (
                <div className="relative animate-in fade-in slide-in-from-top-2 duration-300">
                  <input
                    id="password"
                    type="password"
                    placeholder=""
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    required
                    autoFocus
                    className="w-full h-14 px-4 pr-14 pt-5 pb-1 text-base bg-background border border-border/50 border-t-border/30 rounded-b-xl focus:border-blue-500 focus:outline-none focus:ring-0 transition-all text-foreground"
                  />
                  <label
                    htmlFor="password"
                    className={`absolute left-4 transition-all pointer-events-none ${
                      passwordFocused || password.length > 0
                        ? 'top-2 text-xs text-muted-foreground'
                        : 'top-1/2 -translate-y-1/2 text-base text-muted-foreground/60'
                    }`}
                  >
                    Password
                  </label>
                  <Button
                    type="submit"
                    disabled={password.length === 0 || loading}
                    size="icon"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-border/30 hover:bg-border/50 text-foreground shadow-sm transition-all flex-shrink-0 ${
                      password.length === 0 || loading
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
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <Link
                href="/staff/login"
                className="text-blue-500 hover:text-blue-600 hover:underline transition-colors font-normal"
              >
                Sign in
              </Link>
            </p>
          </div>

          {loading && <p className="text-center text-sm text-muted-foreground pt-2">Creating account…</p>}
        </div>
      </div>
    </div>
  )
}

