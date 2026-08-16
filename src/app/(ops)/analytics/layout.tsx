import { Inter } from "next/font/google"
import type { ReactNode } from "react"

import { OpsBottomNav } from "@/components/navigation/ops-bottom-nav"
import { OpsTablesAttr } from "@/components/navigation/ops-tables-attr"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter-ops" })

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`ops-tables-root dark h-dvh bg-zinc-950 text-zinc-100 font-sans antialiased ${inter.variable}`}>
      <OpsTablesAttr fontVariableClass={inter.variable} />
      <div className="ops-bottom-nav-content">
        {children}
      </div>
      <OpsBottomNav />
    </div>
  )
}
