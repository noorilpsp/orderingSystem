import { Suspense } from 'react'
import { cookies } from 'next/headers'
import Image from 'next/image'

import SignupForm from './components/SignupForm'
import TopMenu from '../login/components/TopMenu'
import { getPublicStoreCountry } from '@/lib/public-menu/getPublicStoreCountry'
import {
  GUEST_LAST_STORE_COOKIE,
  storeSlugFromGuestPath,
} from '@/lib/public-menu/guest-last-store'

async function SignupFormWrapper({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; store?: string }>
}) {
  const params = await searchParams
  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : undefined
  const storeFromQuery = typeof params.store === 'string' ? params.store : null
  const cookieStore = await cookies()
  const storeFromCookie = cookieStore.get(GUEST_LAST_STORE_COOKIE)?.value ?? null
  const storeSlug =
    storeFromQuery ?? storeSlugFromGuestPath(returnTo) ?? storeFromCookie
  const storeCountry = await getPublicStoreCountry(storeSlug)

  return (
    <SignupForm storeSlug={storeSlug} defaultPhoneCountry={storeCountry} />
  )
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; store?: string }>
}) {
  return (
    <div className="min-h-screen bg-background">
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

      <main className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <Suspense fallback={<div className="w-full max-w-2xl">Loading...</div>}>
          <SignupFormWrapper searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  )
}

