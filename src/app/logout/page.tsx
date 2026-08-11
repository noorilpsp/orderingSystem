import { unstable_noStore } from "next/cache"
import Image from "next/image"

import TopMenu from "../staff/login/components/TopMenu"
import LogoutContent from "./components/LogoutContent"

export default async function LogoutPage() {
  unstable_noStore()

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gray-50 border-b border-gray-100 px-6 py-0.5 flex items-center justify-between">
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
        <LogoutContent />
      </main>
    </div>
  )
}
