'use client'

import type React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Link } from '@/components/ui/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowRight } from 'lucide-react'
import { login } from '@/app/actions/auth'
import { unlockIncomingOrderAlertAudio } from '@/lib/orders/incoming-order-alert-sound'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [keepSignedIn, setKeepSignedIn] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [returnTo, setReturnTo] = useState<string | null>(null)

  // Read returnTo from query params and validate
  useEffect(() => {
    const returnToParam = searchParams.get('returnTo')
    if (returnToParam) {
      // Security: Only allow internal redirects (must start with /)
      if (returnToParam.startsWith('/')) {
        setReturnTo(returnToParam)
      } else {
        console.warn('[login] Invalid returnTo URL, ignoring:', returnToParam)
      }
    }
  }, [searchParams])

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setLoading(true)
    setError(null)

    try {
      // Unlock /orders alert audio during this click so new-order sound autoplays later.
      // Soft-navigate after login so the unlocked Audio element stays in memory.
      await unlockIncomingOrderAlertAudio()

      // Call Server Action directly - no fetch needed!
      const result = await login({
        email,
        password,
        remember: keepSignedIn,
      })

      if (result.error) {
        // Handle specific error messages
        if (result.error.toLowerCase().includes('confirm')) {
          setError('Please confirm your email from the link we sent before signing in.')
        } else if (result.error.toLowerCase().includes('invalid')) {
          setError(
            'Email or password is incorrect. Please check your credentials and try again.',
          )
        } else {
          setError(result.error)
        }
        return
      }

      // Soft navigate so login-gesture audio unlock survives into /orders.
      const redirectUrl = returnTo || '/dashboard'
      router.push(redirectUrl)
      router.refresh()
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
              Sign in to BerryTap
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Merchant & restaurant staff access
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
                  className={`w-full h-14 px-4 pr-14 pt-5 pb-1 text-base bg-background border transition-all text-foreground focus:outline-none focus:ring-0 ${
                    emailError
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-border/50 focus:border-blue-500'
                  } ${showPassword ? 'rounded-t-xl border-b-0' : 'rounded-xl'}`}
                />
                <label
                  htmlFor="email"
                  className={`absolute left-4 transition-all pointer-events-none ${
                    emailFocused || email.length > 0
                      ? 'top-2 text-xs text-muted-foreground'
                      : 'top-1/2 -translate-y-1/2 text-base text-muted-foreground/60'
                  }`}
                >
                  Email or Phone Number
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

            <div className="flex items-center justify-center space-x-2 pt-8">
              <Checkbox
                id="keep-signed-in"
                checked={keepSignedIn}
                onCheckedChange={(checked) => setKeepSignedIn(!!checked)}
                className="border-border/60"
              />
              <label
                htmlFor="keep-signed-in"
                className="text-base font-light text-foreground cursor-pointer select-none"
              >
                Keep me signed in
              </label>
            </div>
          </form>

          <div className="flex flex-col items-center gap-2 pt-6 text-sm">
            <Link
              href="/staff/forgot-password"
              className="text-blue-500 hover:text-blue-600 hover:underline transition-colors font-normal flex items-center gap-0.5 cursor-pointer"
            >
              Forgot password?
              <svg
                viewBox="0 0 180 130"
                version="1.1"
                className="w-5 h-5 flex-shrink-0 text-blue-500 -ml-2"
              >
                <g transform="matrix(1 0 0 1 85.49510009765618 114.2884521484375)">
                  <path
                    fill="currentColor"
                    d="M84.5703-17.334L84.5215-66.4551C84.5215-69.2383 82.7148-71.1914 79.7852-71.1914L30.6641-71.1914C27.9297-71.1914 26.0742-69.0918 26.0742-66.748C26.0742-64.4043 28.1738-62.4023 30.4688-62.4023L47.4609-62.4023L71.2891-63.1836L62.207-55.2246L13.8184-6.73828C12.9395-5.85938 12.4512-4.73633 12.4512-3.66211C12.4512-1.31836 14.5508 0.878906 16.9922 0.878906C18.1152 0.878906 19.1895 0.488281 20.0684-0.439453L68.5547-48.877L76.6113-58.0078L75.7324-35.2051L75.7324-17.1387C75.7324-14.8438 77.7344-12.6953 80.127-12.6953C82.4707-12.6953 84.5703-14.6973 84.5703-17.334Z"
                  ></path>
                </g>
              </svg>
            </Link>
            <p className="text-muted-foreground">
              Don't have an account?{' '}
              <Link
                href="/staff/signup"
                className="text-blue-500 hover:text-blue-600 hover:underline transition-colors font-normal"
              >
                Create account
              </Link>
            </p>
          </div>

          {loading && <p className="text-center text-sm text-muted-foreground pt-2">Signing in…</p>}
        </div>
      </div>
    </div>
  )
}

