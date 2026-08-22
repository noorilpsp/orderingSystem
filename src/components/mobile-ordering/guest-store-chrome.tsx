"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { GuestMenuPage } from "@/components/mobile-ordering/guest-menu-page";
import { usePublicMenu } from "@/lib/contexts/PublicMenuContext";
import { isGuestMenuRootPath } from "@/lib/public-menu/guestMenuPaths";

type GuestStoreChromeValue = {
  isMenuVisible: boolean;
  keepMenu: boolean;
  revealMenu: (href: string) => void;
};

const GuestStoreChromeContext = createContext<GuestStoreChromeValue | null>(null);

export function useGuestStoreChromeOptional() {
  return useContext(GuestStoreChromeContext);
}

function modifiedClick(event: React.MouseEvent) {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

/** Instant menu navigation that does not wait for the menu RSC round trip. */
export function GuestMenuLink({
  href,
  onClick,
  prefetch = true,
  ...props
}: ComponentProps<typeof Link>) {
  const chrome = useGuestStoreChromeOptional();

  return (
    <Link
      href={href}
      prefetch={prefetch}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || modifiedClick(event) || !chrome) return;
        event.preventDefault();
        chrome.revealMenu(typeof href === "string" ? href : href.pathname ?? "/");
      }}
      {...props}
    />
  );
}

export function GuestStoreChrome({ children }: { children: ReactNode }) {
  const { storeSlug } = usePublicMenu();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const isMenuRoute = isGuestMenuRootPath(pathname, storeSlug);
  const [keepMenu, setKeepMenu] = useState(isMenuRoute);
  const [forceMenu, setForceMenu] = useState(false);
  const menuScrollYRef = useRef(0);

  const isMenuVisible = isMenuRoute || forceMenu;

  useEffect(() => {
    if (!isMenuRoute) return;
    setKeepMenu(true);
    setForceMenu(false);
  }, [isMenuRoute]);

  useEffect(() => {
    if (!isMenuVisible) return;
    const onScroll = () => {
      menuScrollYRef.current =
        document.scrollingElement?.scrollTop ?? window.scrollY;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMenuVisible]);

  useLayoutEffect(() => {
    if (!isMenuVisible) return;
    const y = menuScrollYRef.current;
    document.scrollingElement?.scrollTo(0, y);
  }, [isMenuVisible, pathname]);

  const revealMenu = useCallback(
    (href: string) => {
      setKeepMenu(true);
      setForceMenu(true);
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [router],
  );

  const value = useMemo(
    () => ({ isMenuVisible, keepMenu, revealMenu }),
    [isMenuVisible, keepMenu, revealMenu],
  );

  return (
    <GuestStoreChromeContext.Provider value={value}>
      {children}
    </GuestStoreChromeContext.Provider>
  );
}

export function GuestStorePages({ children }: { children: ReactNode }) {
  const chrome = useGuestStoreChromeOptional();
  if (!chrome) {
    throw new Error("GuestStorePages must be used within GuestStoreChrome");
  }
  const { isMenuVisible, keepMenu } = chrome;

  return (
    <>
      {keepMenu ? (
        <div
          hidden={!isMenuVisible}
          inert={!isMenuVisible}
          aria-hidden={!isMenuVisible}
        >
          <GuestMenuPage isActive={isMenuVisible} />
        </div>
      ) : null}
      {isMenuVisible ? null : children}
    </>
  );
}
