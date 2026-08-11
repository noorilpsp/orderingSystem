import type { ReactNode } from "react";
import Image from "next/image";
import TopMenu from "@/app/staff/login/components/TopMenu";

export default function DinerAuthLayout({ children }: { children: ReactNode }) {
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
        {children}
      </main>
    </div>
  );
}
