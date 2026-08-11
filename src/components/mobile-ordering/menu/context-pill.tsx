"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Edit3, MoonStar, Package, Sparkles, Sun, X } from "lucide-react";
import { usePublicMenuOptional } from "@/lib/contexts/PublicMenuContext";
import { useGuestLocale, translateGuestMessage, type GuestLocale } from "@/lib/guest-i18n";

type OrderType = "dine-in" | "pickup";
export type ThemePreview = "classic" | "night" | "vivid";

interface ContextPillProps {
  orderType: OrderType;
  tableNumber: string;
  checkRequested: boolean;
  theme?: ThemePreview;
  onThemeChange?: (value: ThemePreview) => void;
  onOrderTypeChange: (value: OrderType) => void;
  onTableNumberChange: (value: string) => void;
  onToast: (message: string, type?: "success" | "warning") => void;
  compact?: boolean;
  className?: string;
}

export function ContextPill({
  orderType,
  tableNumber,
  checkRequested,
  theme,
  onThemeChange,
  onOrderTypeChange,
  onTableNumberChange,
  onToast,
  compact = false,
  className,
}: ContextPillProps) {
  const publicMenu = usePublicMenuOptional();
  const { locale, setLocale, t } = useGuestLocale();
  const pickupInstructions =
    publicMenu?.orderModes?.pickup?.instructions?.trim() ?? "";
  const [expanded, setExpanded] = useState(false);
  const [editingTable, setEditingTable] = useState(false);
  const [draftTable, setDraftTable] = useState(tableNumber);
  const [activeTheme, setActiveTheme] = useState<ThemePreview>(theme ?? "classic");

  // Keep local state aligned when parent controls the theme.
  useEffect(() => {
    if (theme) setActiveTheme(theme);
  }, [theme]);

  // Initialize from persisted value when no controlled theme is passed.
  useEffect(() => {
    if (theme) return;
    const saved = localStorage.getItem("theme") as ThemePreview | null;
    if (saved && ["classic", "night", "vivid"].includes(saved)) {
      setActiveTheme(saved);
    }
  }, [theme]);

  // Apply theme class to <html> and persist.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "vivid");
    if (activeTheme === "night") root.classList.add("dark");
    else if (activeTheme === "vivid") root.classList.add("vivid");
    localStorage.setItem("theme", activeTheme);
  }, [activeTheme]);

  const handleThemeChange = (nextTheme: ThemePreview) => {
    setActiveTheme(nextTheme);
    onThemeChange?.(nextTheme);
    const label =
      nextTheme === "classic"
        ? t("context.themeClassicEnabled")
        : nextTheme === "night"
          ? t("context.themeNightEnabled")
          : t("context.themeVividEnabled");
    onToast(label);
  };

  useEffect(() => {
    setDraftTable(tableNumber);
  }, [tableNumber]);

  const saveTable = () => {
    const cleaned = draftTable.trim().replace(/\D+/g, "");
    if (!cleaned) return;
    onTableNumberChange(cleaned);
    onToast(t("context.tableUpdated", { number: cleaned }));
    setEditingTable(false);
    setExpanded(false);
  };

  const handleLocaleChange = (next: GuestLocale) => {
    setLocale(next);
    onToast(
      next === "en"
        ? translateGuestMessage("en", "locale.setEnglish")
        : translateGuestMessage("ar", "locale.setArabic"),
    );
  };

  const isDineIn = orderType === "dine-in";
  const secondaryLabelClass = "font-normal text-white/75 dark:text-blue-200/80 vivid:text-white/80";

  return (
    <div
      className={cn(
        "context-pill relative",
        expanded ? "z-[var(--z-popover)]" : "z-[var(--z-hero)]",
        compact ? "inline-block" : "my-3 px-4",
        className
      )}
    >
      {expanded && (
        <button
          type="button"
          aria-label={t("context.closePanel")}
          className="context-pill-backdrop fixed inset-0 z-[calc(var(--z-popover)-1)] bg-black/20"
          onClick={() => {
            setExpanded(false);
            setEditingTable(false);
          }}
        />
      )}

      <div
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((prev) => !prev);
          }
        }}
        className={cn(
          "relative z-[var(--z-hero)] cursor-pointer rounded-xl border backdrop-blur-xl transition-all duration-300 liquid-glass",
          compact && "w-fit",
          expanded
            ? "border-white/24 bg-black/76 shadow-[0_14px_34px_rgba(0,0,0,0.42)] ring-1 ring-white/10 dark:border-blue-300/25 dark:bg-blue-900/55 dark:ring-blue-300/20 vivid:border-white/45 vivid:bg-black/72 vivid:ring-white/28"
            : "border-white/26 bg-black/72 ring-1 ring-white/12 shadow-[0_12px_30px_rgba(0,0,0,0.36)] dark:border-blue-300/25 dark:bg-blue-900/55 dark:ring-blue-300/22 vivid:border-white/45 vivid:bg-black/70 vivid:ring-white/28"
        )}
      >
        <div
          className={cn(
            "flex items-center",
            compact
              ? "min-h-9 justify-start gap-0.5 pl-2 pr-0.5 py-1.5"
              : "min-h-11 justify-between px-3 py-2"
          )}
        >
          <div className={cn("min-w-0 flex items-center gap-2", compact && "gap-1.5")}>
            {isDineIn ? (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="context-dot-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
            ) : (
              <Package className="h-4 w-4 shrink-0 text-amber-300" />
            )}
            <p
              className={cn(
                "truncate text-white dark:text-blue-100 vivid:text-white",
                compact ? "whitespace-nowrap text-xs" : "text-sm"
              )}
            >
              {isDineIn ? (
                tableNumber.trim() ? (
                  <>
                    <span className="font-semibold text-white dark:text-blue-100 vivid:text-white">
                      {t("context.tableNumber", { number: tableNumber })}
                    </span>
                    {checkRequested ? (
                      <span className={secondaryLabelClass}>
                        {" · "}
                        {t("actions.checkRequested")}
                      </span>
                    ) : (
                      <span className="font-semibold text-white dark:text-blue-100 vivid:text-white">
                        {" · "}
                        {t("context.dineIn")}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="font-semibold text-white dark:text-blue-100 vivid:text-white">
                    {t("context.dineIn")}
                  </span>
                )
              ) : (
                <span className="font-semibold">{t("context.pickup")}</span>
              )}
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={expanded ? t("context.closePanel") : t("context.theme")}
            className={cn(
              "rounded-full hover:bg-accent/70",
              compact ? "h-7" : "h-8",
              expanded
                ? compact
                  ? "-ml-0.5 w-5 text-white/75 hover:text-white dark:text-blue-200/80 dark:hover:text-blue-100 vivid:text-white/80 vivid:hover:text-white"
                  : "w-8 text-white/75 hover:text-white dark:text-blue-200/80 dark:hover:text-blue-100 vivid:text-white/80 vivid:hover:text-white"
                : compact
                  ? "-ml-0.5 w-5 text-white/90 hover:text-white dark:text-blue-100 dark:hover:text-white vivid:text-white vivid:hover:text-white/85"
                  : "w-8 text-white/90 hover:text-white dark:text-blue-100 dark:hover:text-white vivid:text-white vivid:hover:text-white/85"
            )}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((prev) => !prev);
              if (expanded) setEditingTable(false);
            }}
          >
            {expanded ? (
              <X className="h-4 w-4" />
            ) : (
              <ChevronDown className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
            )}
          </Button>
        </div>

      </div>

      {expanded && (
        <div
          className={cn(
            "absolute top-full z-[var(--z-popover)] mt-2 animate-in slide-in-from-top-2 fade-in-0 rounded-xl border border-white/24 bg-black/78 px-3 pb-3 pt-1 shadow-[0_16px_36px_rgba(0,0,0,0.44)] ring-1 ring-white/10 backdrop-blur-2xl duration-300 liquid-glass dark:border-blue-300/25 dark:bg-blue-900/55 dark:ring-blue-300/20 vivid:border-white/45 vivid:bg-black/74 vivid:ring-white/28",
            compact ? "right-0 w-[min(92vw,19rem)]" : "left-4 right-4"
          )}
        >
          <div className="pt-1">
            <div className="rounded-lg border border-white/22 bg-black/34 p-2 dark:border-blue-300/22 dark:bg-blue-950/35 vivid:border-white/45 vivid:bg-black/35">
              <div className="mb-2 text-xs font-medium text-white/75 dark:text-blue-200/80 vivid:text-white/80">
                {t("context.theme")}
              </div>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("context.theme")}>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t("context.classic")}
                  aria-pressed={activeTheme === "classic"}
                  className={cn(
                    "h-10 rounded-md border px-2 text-white hover:bg-white/10 dark:text-blue-100 dark:hover:bg-blue-800/40 vivid:text-white vivid:hover:bg-white/10",
                    activeTheme === "classic"
                      ? "border-white/45 bg-white/12 text-white dark:border-blue-300/50 dark:bg-blue-400/15 dark:text-blue-100 vivid:border-white/45 vivid:bg-white/12 vivid:text-white"
                      : "border-white/20 dark:border-blue-300/25 vivid:border-white/30"
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleThemeChange("classic");
                  }}
                >
                  <Sun className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t("context.night")}
                  aria-pressed={activeTheme === "night"}
                  className={cn(
                    "h-10 rounded-md border px-2 text-white hover:bg-white/10 dark:text-blue-100 dark:hover:bg-blue-800/40 vivid:text-white vivid:hover:bg-white/10",
                    activeTheme === "night"
                      ? "border-white/45 bg-white/12 text-white dark:border-blue-300/50 dark:bg-blue-400/15 dark:text-blue-100 vivid:border-white/45 vivid:bg-white/12 vivid:text-white"
                      : "border-white/20 dark:border-blue-300/25 vivid:border-white/30"
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleThemeChange("night");
                  }}
                >
                  <MoonStar className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t("context.vivid")}
                  aria-pressed={activeTheme === "vivid"}
                  className={cn(
                    "h-10 rounded-md border px-2 text-white hover:bg-white/10 dark:text-blue-100 dark:hover:bg-blue-800/40 vivid:text-white vivid:hover:bg-white/10",
                    activeTheme === "vivid"
                      ? "border-white/45 bg-white/12 text-white dark:border-blue-300/50 dark:bg-blue-400/15 dark:text-blue-100 vivid:border-white/45 vivid:bg-white/12 vivid:text-white"
                      : "border-white/20 dark:border-blue-300/25 vivid:border-white/30"
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleThemeChange("vivid");
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {isDineIn ? (
              <Button
                type="button"
                variant="ghost"
                className="mt-1 h-12 w-full justify-start gap-3 rounded-lg px-2 text-white hover:bg-white/10 dark:text-blue-100 dark:hover:bg-blue-800/35 vivid:text-white vivid:hover:bg-white/10"
                onClick={() => {
                  onOrderTypeChange("pickup");
                  onToast(t("context.switchedToPickup"));
                  setExpanded(false);
                }}
              >
                <Package className="h-4 w-4" />
                <span>{t("context.switchToPickup")}</span>
              </Button>
            ) : null}

            {isDineIn ? (
              !editingTable ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 w-full justify-start gap-3 rounded-lg px-2 text-white hover:bg-white/10 dark:text-blue-100 dark:hover:bg-blue-800/35 vivid:text-white vivid:hover:bg-white/10"
                  onClick={() => setEditingTable(true)}
                >
                  <Edit3 className="h-4 w-4" />
                  <span>{t("context.editTable")}</span>
                </Button>
              ) : (
                <div className="rounded-lg border border-white/22 bg-black/34 p-2 dark:border-blue-300/22 dark:bg-blue-950/35 vivid:border-white/45 vivid:bg-black/35">
                  <div className="mb-2 flex items-center gap-2 text-sm text-white dark:text-blue-100 vivid:text-white">
                    <Edit3 className="h-4 w-4" />
                    <span>{t("context.table")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={t("context.table")}
                      inputMode="numeric"
                      autoFocus
                      value={draftTable}
                      onChange={(event) => setDraftTable(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveTable();
                        }
                      }}
                      className="h-10 border-white/25 bg-black/45 text-white placeholder:text-white/50 dark:border-blue-300/25 dark:bg-blue-950/45 dark:text-blue-100 vivid:border-white/35 vivid:bg-black/55 vivid:text-white vivid:placeholder:text-white/55"
                    />
                    <Button
                      type="button"
                      className="h-10 bg-emerald-600 text-white hover:bg-emerald-500"
                      onClick={saveTable}
                    >
                      {t("common.save")}
                    </Button>
                  </div>
                </div>
              )
            ) : null}

            <div className="mt-1 rounded-lg border border-white/22 bg-black/34 p-2 dark:border-blue-300/22 dark:bg-blue-950/35 vivid:border-white/45 vivid:bg-black/35">
              <div className="mb-2 text-xs font-medium text-white/75 dark:text-blue-200/80 vivid:text-white/80">
                {t("locale.label")}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={locale === "en"}
                  className={cn(
                    "flex-1 border text-white hover:bg-white/10 dark:text-blue-100 dark:hover:bg-blue-800/35 vivid:text-white vivid:hover:bg-white/10",
                    locale === "en"
                      ? "border-white/45 bg-white/12 text-white dark:border-blue-300/50 dark:bg-blue-400/15 dark:text-blue-100 vivid:border-white/45 vivid:bg-white/12 vivid:text-white"
                      : "border-white/20 dark:border-blue-300/25 vivid:border-white/30"
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleLocaleChange("en");
                  }}
                >
                  {t("locale.english")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={locale === "ar"}
                  className={cn(
                    "flex-1 border text-white hover:bg-white/10 dark:text-blue-100 dark:hover:bg-blue-800/35 vivid:text-white vivid:hover:bg-white/10",
                    locale === "ar"
                      ? "border-white/45 bg-white/12 text-white dark:border-blue-300/50 dark:bg-blue-400/15 dark:text-blue-100 vivid:border-white/45 vivid:bg-white/12 vivid:text-white"
                      : "border-white/20 dark:border-blue-300/25 vivid:border-white/30"
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleLocaleChange("ar");
                  }}
                >
                  {t("locale.arabic")}
                </Button>
              </div>
            </div>

            {!isDineIn && pickupInstructions ? (
              <div className="mt-1 rounded-lg px-2 py-2 text-sm text-white/75 dark:text-blue-200/80 vivid:text-white/80">
                {t("context.pickupInstructions")} {pickupInstructions}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
