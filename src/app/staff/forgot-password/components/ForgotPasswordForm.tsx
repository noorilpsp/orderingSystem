'use client'

import type React from 'react'
import { useState } from 'react'
import { Link } from '@/components/ui/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { forgotPassword } from '@/app/actions/auth'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [emailFocused, setEmailFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value
    setEmail(newEmail)

    // Clear errors when user starts typing
    if (error) setError(null)
    if (emailError) setEmailError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email)) {
      setEmailError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError(null)
    setEmailError(null)

    try {
      // Call Server Action directly - no fetch needed!
      const result = await forgotPassword({ email })

      if (result.error) {
        setError(result.error)
        return
      }

      setSuccess(true)
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
                Check your email
              </h1>
              <p className="text-muted-foreground">
                We've sent a password reset link to <strong>{email}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Click the link in the email to reset your password. If you don't see it, check your spam folder.
              </p>
            </div>

            <div className="flex flex-col items-center gap-2 pt-6 text-sm">
              <Link
                href="/staff/login"
                className="text-blue-500 hover:text-blue-600 hover:underline transition-colors font-normal"
              >
                Back to sign in
              </Link>
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
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your staff email and we&apos;ll send a reset link
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
                className={`w-full h-14 px-4 pr-14 pt-5 pb-1 text-base bg-background border transition-all text-foreground focus:outline-none focus:ring-0 rounded-xl ${
                  emailError
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-border/50 focus:border-blue-500'
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
              <Button
                type="submit"
                disabled={email.length === 0 || loading || !!emailError}
                size="icon"
                className={`absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-border/30 hover:bg-border/50 text-foreground shadow-sm transition-all flex-shrink-0 ${
                  email.length === 0 || loading || !!emailError
                    ? 'opacity-40 cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
              >
                <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                <span className="sr-only">Submit</span>
              </Button>
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
            <p className="text-center text-sm text-muted-foreground pt-2">Sending reset link…</p>
          )}
        </div>
      </div>
    </div>
  )
}

