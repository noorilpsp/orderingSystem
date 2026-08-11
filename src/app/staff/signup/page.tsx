import { Suspense } from 'react'
import Image from 'next/image'

import SignupForm from './components/SignupForm'
import TopMenu from '../login/components/TopMenu'

function SignupFormWrapper() {
  return <SignupForm />
}

export default async function SignupPage() {
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
        <Suspense fallback={<div className="w-full max-w-2xl">Loading...</div>}>
          <SignupFormWrapper />
        </Suspense>
      </main>
    </div>
  )
}

