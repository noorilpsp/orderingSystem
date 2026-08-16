"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import { LayoutGrid, Clock, FolderOpen, Package, Settings2, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Tab {
  name: string
  href: string
  icon: LucideIcon
}

const tabs: Tab[] = [
  { name: "Overview", href: "/dashboard/menu/overview", icon: LayoutGrid },
  { name: "Menus", href: "/dashboard/menu/menus", icon: Clock },
  { name: "Categories", href: "/dashboard/menu/categories", icon: FolderOpen },
  { name: "Items", href: "/dashboard/menu/items", icon: Package },
  { name: "Customizations", href: "/dashboard/menu/customizations", icon: Settings2 },
]

interface MenuTabsProps {
  currentPath?: string
}

export function MenuTabs({ currentPath }: MenuTabsProps) {
  const pathname = usePathname()
  const activePath = currentPath || pathname

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [hoverStyle, setHoverStyle] = useState({})
  const [activeStyle, setActiveStyle] = useState({ left: "0px", width: "0px" })
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const navRef = useRef<HTMLDivElement>(null)

  const activeIndex = tabs.findIndex((tab) => activePath === tab.href)

  useEffect(() => {
    if (hoveredIndex !== null && navRef.current) {
      const hoveredElement = tabRefs.current[hoveredIndex]
      if (hoveredElement) {
        const navRect = navRef.current.getBoundingClientRect()
        const tabRect = hoveredElement.getBoundingClientRect()
        setHoverStyle({
          left: `${tabRect.left - navRect.left}px`,
          width: `${tabRect.width}px`,
        })
      }
    }
  }, [hoveredIndex])

  useEffect(() => {
    const updateActivePosition = () => {
      if (activeIndex !== -1 && navRef.current) {
        const activeElement = tabRefs.current[activeIndex]
        if (activeElement) {
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            const navRect = navRef.current?.getBoundingClientRect()
            const tabRect = activeElement.getBoundingClientRect()
            if (navRect) {
              setActiveStyle({
                left: `${tabRect.left - navRect.left}px`,
                width: `${tabRect.width}px`,
              })
            }
          })
        }
      }
    }

    // Initial position update
    updateActivePosition()

    // Update on window resize
    window.addEventListener("resize", updateActivePosition)
    return () => window.removeEventListener("resize", updateActivePosition)
  }, [activeIndex, activePath]) // Added activePath as dependency

  return (
    <div className="sticky top-0 z-20 shrink-0 border-b bg-background">
      <TooltipProvider>
        <nav
          ref={navRef}
          className="relative flex overflow-x-auto scrollbar-hide snap-x snap-mandatory md:overflow-visible justify-around md:justify-start px-4 md:px-6"
          aria-label="Menu navigation"
        >
          <div
            className="absolute h-full top-0 transition-all duration-300 ease-out bg-accent rounded-lg pointer-events-none z-0"
            style={{
              ...hoverStyle,
              opacity: hoveredIndex !== null ? 1 : 0,
            }}
          />

          <div
            className="absolute bottom-0 h-[2px] bg-orange-500 transition-all duration-300 ease-out z-0"
            style={activeStyle}
          />

          {tabs.map((tab, index) => {
            const isActive = activePath === tab.href
            const Icon = tab.icon

            return (
              <Tooltip key={tab.name}>
                <TooltipTrigger asChild>
                  <Link
                    ref={(el) => (tabRefs.current[index] = el)}
                    href={tab.href}
                    className={cn(
                      "relative z-10 flex items-center gap-2 py-4 text-sm font-medium transition-colors whitespace-nowrap snap-start",
                      "px-4 md:px-6 flex-1 md:flex-initial justify-center md:justify-start min-w-0 md:min-w-fit",
                      isActive ? "text-orange-600 font-semibold" : "text-muted-foreground hover:text-foreground",
                    )}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={tab.name}
                  >
                    <Icon className="h-5 w-5 md:h-4 md:w-4 flex-shrink-0" />
                    <span className="hidden md:inline">{tab.name}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent className="md:hidden">
                  <p>{tab.name}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>
      </TooltipProvider>
    </div>
  )
}
