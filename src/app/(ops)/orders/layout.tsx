import { Inter } from "next/font/google"
import type { Metadata } from "next"
import type { ReactNode } from "react"

import { OpsTablesAttr } from "@/components/navigation/ops-tables-attr"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter-ops" })

export const metadata: Metadata = {
  title: "Orders",
  applicationName: "NextFaster Orders",
  appleWebApp: {
    capable: true,
    title: "Orders",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest-orders.webmanifest",
  icons: {
    icon: [
      { url: "/icon-orders-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-orders-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-orders-192.png", sizes: "192x192", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function OrdersLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`ops-tables-root dark h-dvh bg-zinc-950 text-zinc-100 font-sans antialiased ${inter.variable}`}>
      <OpsTablesAttr fontVariableClass={inter.variable} />
      <div className="h-full min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
