import type { Metadata } from "next";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
import { RESERVED_STORE_SLUGS } from "@/lib/public-menu/guestMenuPaths";

export const metadata: Metadata = {
  title: {
    template: "%s | NextFaster",
    default: "NextFaster",
  },
  description: "A performant site built with Next.js",
  applicationName: "BerryTap",
  appleWebApp: {
    capable: true,
    title: "BerryTap",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/BSVG.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const revalidate = 86400; // One day

const guestThemeBootScript = `(function(){try{var p=location.pathname;if(p.startsWith("/reservations")||p.startsWith("/kds")){document.documentElement.classList.add("dark");if(p.startsWith("/reservations"))document.documentElement.dataset.opsReservations="true";return;}var reserved=new Set(${JSON.stringify(RESERVED_STORE_SLUGS)});var segs=p.split("/").filter(Boolean);var first=(segs[0]||"").toLowerCase();var isGuest=p==="/mobile"||p.startsWith("/mobile/")||(first==="menu"&&segs.length>=2)||(first&&!reserved.has(first)&&/^[a-z0-9-]+$/.test(first));if(isGuest){document.documentElement.classList.add("liquid-glass-page");var t=localStorage.getItem("theme");if(t==="night")document.documentElement.classList.add("dark");else if(t==="vivid")document.documentElement.classList.add("vivid");}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: guestThemeBootScript,
          }}
        />
      </head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} flex flex-col overflow-y-auto overflow-x-hidden antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
