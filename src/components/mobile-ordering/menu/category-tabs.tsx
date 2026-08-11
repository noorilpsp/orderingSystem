"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { GuestCategory } from "@/lib/guest-menu/types";
import { resolveCatalogText } from "@/lib/catalog-i18n";
import { useGuestLocale } from "@/lib/guest-i18n";

interface CategoryTabsProps {
  categories: GuestCategory[];
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
  isSticky: boolean;
  tabsContainerRef: React.RefObject<HTMLDivElement | null>;
  isSearchOpen: boolean;
  searchQuery: string;
  onSearchOpenChange: (open: boolean) => void;
  onSearchQueryChange: (query: string) => void;
}

export function CategoryTabs({
  categories,
  activeCategory,
  onCategoryChange,
  isSticky,
  tabsContainerRef,
  isSearchOpen,
  searchQuery,
  onSearchOpenChange,
  onSearchQueryChange,
}: CategoryTabsProps) {
  const { locale } = useGuestLocale();
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const activeBtnRef = useRef<HTMLButtonElement>(null);

  const updatePillPosition = useCallback(() => {
    const container = tabsContainerRef.current;
    const button = activeBtnRef.current;
    if (!container || !button) {
      setPillStyle((prev) => (prev.opacity === 0 ? prev : { ...prev, opacity: 0 }));
      return;
    }

    setPillStyle({
      left: button.offsetLeft,
      width: button.offsetWidth,
      opacity: 1,
    });
  }, [tabsContainerRef]);

  useLayoutEffect(() => {
    if (isSearchOpen) return;
    updatePillPosition();
  }, [activeCategory, categories, isSearchOpen, locale, updatePillPosition]);

  useEffect(() => {
    if (isSearchOpen) return;
    const container = tabsContainerRef.current;
    if (!container) return;

    const handleScroll = () => updatePillPosition();
    container.addEventListener("scroll", handleScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      updatePillPosition();
    });
    resizeObserver.observe(container);
    if (activeBtnRef.current) {
      resizeObserver.observe(activeBtnRef.current);
    }

    window.addEventListener("resize", updatePillPosition);
    return () => {
      container.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updatePillPosition);
    };
  }, [activeCategory, isSearchOpen, tabsContainerRef, updatePillPosition]);

  return (
    <div
      className={`liquid-glass rounded-none border-b border-border/50 transition-shadow duration-300 ${
        isSticky ? "shadow-lg shadow-black/5" : ""
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        {!isSearchOpen ? (
          <button
            type="button"
            aria-label="Search menu"
            className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => onSearchOpenChange(true)}
          >
            <Search className="h-4 w-4" />
          </button>
        ) : null}

        {isSearchOpen ? (
          <div className="flex flex-1 items-center gap-2">
            <div className="flex h-9 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="Search all menu items..."
                className="h-full w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                autoFocus
                aria-label="Search menu items"
              />
            </div>
            <button
              type="button"
              aria-label="Close search"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => {
                onSearchOpenChange(false);
                onSearchQueryChange("");
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            ref={tabsContainerRef}
            className="relative flex flex-1 gap-1.5 overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <div
              className="sheen-overlay absolute top-0 h-full rounded-xl border border-white/24 bg-black/76 backdrop-blur-2xl ring-1 ring-white/10 transition-[left,width,opacity] pointer-events-none dark:border-blue-300/25 dark:bg-blue-900/55 dark:backdrop-blur-xl vivid:border-white/50 vivid:bg-white/72 vivid:backdrop-blur-xl"
              style={{
                left: `${pillStyle.left}px`,
                width: `${pillStyle.width}px`,
                opacity: pillStyle.opacity,
                transitionDuration: "250ms",
                transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
              }}
            />

            {categories.map((category) => {
              const localizedName = resolveCatalogText(
                locale,
                { name: category.name },
                category.i18n,
              ).name;
              const isActive = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  ref={isActive ? activeBtnRef : null}
                  type="button"
                  onClick={() => onCategoryChange(category.id)}
                  data-category-id={category.id}
                  className={`relative z-10 flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm transition-colors duration-250 ${
                    isActive
                      ? "font-bold text-white dark:text-white vivid:text-black"
                      : "text-muted-foreground hover:text-foreground font-medium"
                  }`}
                >
                  {category.emoji ? (
                    <span className="text-base">{category.emoji}</span>
                  ) : null}
                  <span>{localizedName}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
