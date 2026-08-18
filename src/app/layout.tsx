import type { Metadata } from "next";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: {
    template: "%s | NextFaster",
    default: "NextFaster",
  },
  description: "A performant site built with Next.js",
};

export const revalidate = 86400; // One day

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
            __html: `(function(){try{var p=location.pathname;if(p.startsWith("/reservations")||p.startsWith("/kds")){document.documentElement.classList.add("dark");if(p.startsWith("/reservations"))document.documentElement.dataset.opsReservations="true";return;}if(p.startsWith("/mobile")||p.startsWith("/menu/")){document.documentElement.classList.add("liquid-glass-page");var t=localStorage.getItem("theme");if(t==="night")document.documentElement.classList.add("dark");else if(t==="vivid")document.documentElement.classList.add("vivid");}}catch(e){}})();`,
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
