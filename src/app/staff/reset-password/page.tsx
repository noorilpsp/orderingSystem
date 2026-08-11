import { Suspense } from 'react'
import Image from 'next/image'

import ResetPasswordForm from './components/ResetPasswordForm'
import TopMenu from '../login/components/TopMenu'

function ResetPasswordFormSkeleton() {
  return (
    <div className="w-full max-w-2xl">
      <div className="p-6 sm:p-12 sm:shadow-xl sm:border sm:border-border/40 sm:bg-card sm:rounded-3xl">
        <div className="space-y-8">
          <div className="flex justify-center">
            <div className="w-28 h-28 relative bg-muted animate-pulse rounded" />
          </div>
          <div className="text-center space-y-4">
            <div className="h-8 bg-muted animate-pulse rounded w-64 mx-auto" />
            <div className="h-4 bg-muted animate-pulse rounded w-48 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default async function ResetPasswordPage() {
  // Note: Authentication redirect is handled by proxy.ts
  // Authenticated users are automatically redirected to /dashboard before this page renders

  return (
    <div className="min-h-screen bg-background">
      {/* Header with logo and top menu */}
      <header className=" bg-gray-50 border-b border-gray-100 px-6 py-0.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src="/BerryTapSVG.svg"
            alt="BerryTap Logo"
            width={25}
            height={12}
            className="w-25 h-10"
          />
        </div>
        <TopMenu />
      </header>

      {/* Main content */}
      <main className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <Suspense fallback={<ResetPasswordFormSkeleton />}>
          <ResetPasswordForm />
        </Suspense>
      </main>
    </div>
  )
}

