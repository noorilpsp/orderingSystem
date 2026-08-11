"use client"

import React, { useRef } from "react"

import { useState, useCallback, useEffect, startTransition } from "react"
import { FloorMapPageSkeleton } from "@/components/floor-map/FloorMapPageSkeleton"
import { FloorMapNoLocationState } from "@/components/floor-map/FloorMapNoLocationState"
import { FloorMapErrorState } from "@/components/floor-map/FloorMapErrorState"
import { FloorMapStaleBanner } from "@/components/floor-map/FloorMapStaleBanner"
import { MapTopBar } from "@/components/floor-map/map-top-bar"
import { MapStatsBar } from "@/components/floor-map/map-stats-bar"
import { MapCanvas } from "@/components/floor-map/map-canvas"
import { GridView } from "@/components/floor-map/grid-view"
import { QuickActionsMenu } from "@/components/floor-map/quick-actions-menu"
import { SeatPartyModal } from "@/components/floor-map/seat-party-modal"
import {
  filterTablesByMode,
  buildSectionConfig,
  getSectionBounds,
} from "@/lib/floor-map-data"
import { buildFloorMapLiveDetail, type FloorMapLiveDetail } from "@/lib/floor-map-live-detail"
import { setLastViewedFloorMapFloorplanId } from "@/app/actions/floor-map-preferences"
import { setActiveFloorplanIdDb } from "@/lib/floorplan-storage-db"
import type { SavedFloorplan } from "@/lib/floorplan-storage-db"
import { useFloorMapView } from "@/lib/hooks/useFloorMapView"
import { prefetchFloorMapView } from "@/lib/floor-map/prefetchFloorMapView"
import { useFloorMapMutations } from "@/lib/hooks/useFloorMapMutations"
import { hasBillRequest, hasWaiterRequestAlert } from "@/lib/floor-map/acknowledgeTableService"
import { setLastViewedFloorplanClient } from "@/lib/floor-map/lastViewedFloorplan"
import {
  viewTablesToFloorTables,
} from "@/lib/floor-map/floorMapView"
import { useLocation } from "@/lib/contexts/LocationContext"
import { OPS_POST_SEATING_EVENT, type PostSeatingDetail } from "@/lib/view-cache"
import { FloorplanSelector } from "@/components/floor-map/floorplan-selector"
import type { FilterMode, ViewMode, SectionId, SeatPartyForm } from "@/lib/floor-map-data"
import { Plus, Hammer } from "lucide-react"
import Link from "next/link"
import {
  ZOOM_LEVELS,
  DURATIONS,
  getAnimatedDuration,
  getTableCenter,
} from "@/lib/animation-config"
import { usePrefersReducedMotion } from "@/hooks/use-map-gestures"
import { useIsMobile } from "@/hooks/use-mobile"
import { useRouter, useSearchParams } from "next/navigation"
import { prefetchRoute } from "@/components/ui/link"
import type { FloorMapView } from "@/lib/floor-map/floorMapView"
import { getFloorTableColorState, TABLE_COLOR_STATES, type TableColorState } from "@/lib/table-color-state"

type FloorMapClientProps = {
  initialFloorMapView: FloorMapView | null;
  initialLoadError?: string | null;
};

export function FloorMapClient({ initialFloorMapView, initialLoadError = null }: FloorMapClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const floorplanParam = searchParams.get("floorplan")?.trim() || null
  const searchParamsSnapshot = searchParams.toString()
  const { currentLocationId, loading: locationLoading } = useLocation()
  const locationIdResolved = !locationLoading
  const initialSelectedFloorplanId = floorplanParam ?? initialFloorMapView?.floorplan.activeId ?? null
  /**
   * Keep the currently displayed floorplan stable across hydration.
   * The server render already resolved the best first-paint floorplan, so do not
   * re-query a different active plan on mount and override it.
   */
  const [selectedFloorplanId, setSelectedFloorplanId] = React.useState<string | null>(initialSelectedFloorplanId)
  React.useEffect(() => {
    if (floorplanParam) {
      setSelectedFloorplanId(floorplanParam)
      return
    }
    if (!currentLocationId) {
      setSelectedFloorplanId(null)
      return
    }
    setSelectedFloorplanId(initialFloorMapView?.floorplan.activeId ?? null)
  }, [currentLocationId, floorplanParam, initialFloorMapView?.floorplan.activeId])
  React.useEffect(() => {
    setLastViewedFloorplanClient(currentLocationId, selectedFloorplanId)
  }, [currentLocationId, selectedFloorplanId])
  const isMobile = useIsMobile()
  const reducedMotion = usePrefersReducedMotion()
  const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1024

  const { view, loading: viewLoading, error: viewError, staleError, refresh, patch } = useFloorMapView(
    currentLocationId,
    selectedFloorplanId,
    { initialData: initialFloorMapView, initialError: initialLoadError }
  )
  const { seatParty, markTableAvailable, acknowledgeService } = useFloorMapMutations({ patch, refresh, view })

  const currentServer = React.useMemo(() => {
    const cs = view?.currentServer
    if (!cs) return { id: "s1", name: "Sarah", section: "main", assignedTables: [] as string[] }
    return { ...cs, assignedTables: cs.assignedTableIds }
  }, [view?.currentServer])

  const tables = React.useMemo(
    () => (view ? viewTablesToFloorTables(view.tables) : []),
    [view]
  )
  const sectionConfig = buildSectionConfig(view?.sections)
  const floorplanElements = view?.floorplan.elements ?? []
  const allFloorplans = React.useMemo(
    () =>
      (view?.allFloorplans ?? []).map((fp) => ({
        id: fp.id,
        name: fp.name,
        elements: [],
        totalSeats: 0,
      })) as SavedFloorplan[],
    [view?.allFloorplans]
  )
  const activeFloorplanId = view?.floorplan.activeId ?? null
  /** Prefer explicit selection so Map/Grid and dropdowns match before the new view finishes loading. */
  const displayActiveFloorplanId = selectedFloorplanId ?? activeFloorplanId

  const prefetchFloorplanKey = React.useMemo(() => {
    if (!currentLocationId || !view?.allFloorplans?.length || !view.floorplan.activeId) return null
    const active = view.floorplan.activeId
    const others = view.allFloorplans
      .map((fp) => fp.id)
      .filter((id): id is string => Boolean(id) && id !== active)
    if (others.length === 0) return null
    return { locationId: currentLocationId, ids: [...new Set(others)].sort().join(",") }
  }, [currentLocationId, view?.floorplan.activeId, view?.allFloorplans])

  React.useEffect(() => {
    if (!prefetchFloorplanKey) return
    const { locationId, ids } = prefetchFloorplanKey
    for (const floorplanId of ids.split(",").filter(Boolean)) {
      void prefetchFloorMapView(locationId, floorplanId)
    }
  }, [prefetchFloorplanKey])

  const planViewPending = Boolean(
    selectedFloorplanId &&
      view &&
      !staleError &&
      view.floorplan.activeId !== selectedFloorplanId
  )

  const liveDetailByTableId = React.useMemo(() => {
    const map = new Map<string, FloorMapLiveDetail | null>()
    for (const t of tables) {
      map.set(t.id, buildFloorMapLiveDetail(t, undefined, undefined))
    }
    return map
  }, [tables])

  const applyFloorplanSelection = useCallback(
    async (floorplanId: string | null) => {
      if (!currentLocationId) return
      setSelectedFloorplanId(floorplanId)
      setLastViewedFloorplanClient(currentLocationId, floorplanId)
      await Promise.all([
        setActiveFloorplanIdDb(currentLocationId, floorplanId),
        setLastViewedFloorMapFloorplanId(currentLocationId, floorplanId),
      ])
      const next = new URLSearchParams(searchParamsSnapshot)
      if (floorplanId) next.set("floorplan", floorplanId)
      else next.delete("floorplan")
      const q = next.toString()
      router.replace(q ? `/floor-map?${q}` : `/floor-map`, { scroll: false })
    },
    [currentLocationId, router, searchParamsSnapshot]
  )

  const handleFloorplanChange = useCallback(
    async (floorplan: SavedFloorplan | null) => {
      await applyFloorplanSelection(floorplan?.id ?? null)
    },
    [applyFloorplanSelection]
  )

  const handleFloorplanIdChange = useCallback(
    (floorplanId: string) => {
      void applyFloorplanSelection(floorplanId)
    },
    [applyFloorplanSelection]
  )

  const [filterMode, setFilterMode] = useState<FilterMode>("all")
  const [viewMode, setViewMode] = useState<ViewMode>("map")
  const [statusFilter, setStatusFilter] = useState<TableColorState | null>(null)
  const [sectionFilter, setSectionFilter] = useState<SectionId | null>(null)

  const [scale, setScale] = useState(ZOOM_LEVELS.level1.scale)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isTransitioning, setIsTransitioning] = useState(false)

  const [highlightedTableId, setHighlightedTableId] = useState<string | null>(null)
  const [highlightType, setHighlightType] = useState<"search" | "alert" | null>(null)
  const [focusedSection, setFocusedSection] = useState<SectionId | null>(null)

  const [quickAction, setQuickAction] = useState<{
    tableId: string
    tableNumber: number
    position: { x: number; y: number }
    isCleaning?: boolean
    hasWaiterRequest?: boolean
    hasBillRequest?: boolean
  } | null>(null)
  const [navigatingTableId, setNavigatingTableId] = useState<string | null>(null)

  const [seatPartyOpen, setSeatPartyOpen] = useState(false)
  const [seatPartyPreSelect, setSeatPartyPreSelect] = useState<string | null>(null)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)

  const [viewTransition, setViewTransition] = useState<
    "none" | "grid-exit" | "map-enter" | "map-exit" | "grid-enter"
  >("none")
  const [mapEntering, setMapEntering] = useState(true)

  useEffect(() => {
    if (isMobile) setViewMode("grid")
  }, [isMobile])

  useEffect(() => {
    if (viewMode === "map") {
      setMapEntering(true)
      const timer = setTimeout(
        () => setMapEntering(false),
        reducedMotion ? 1 : 400
      )
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const handler = (e: CustomEvent<PostSeatingDetail>) => {
      if (e.detail?.locationId === currentLocationId) void refresh(true)
    }
    window.addEventListener(OPS_POST_SEATING_EVENT, handler as EventListener)
    return () => window.removeEventListener(OPS_POST_SEATING_EVENT, handler as EventListener)
  }, [currentLocationId, refresh])

  const tableColorById = React.useMemo(() => {
    const map = new Map<string, TableColorState>()
    for (const t of tables) {
      const detail = liveDetailByTableId.get(t.id) ?? null
      const reserved = Boolean((t as unknown as { reserved?: boolean }).reserved)
      map.set(
        t.id,
        getFloorTableColorState({
          status: t.status,
          reserved,
          alerts: detail?.alerts ?? [],
          waves: detail?.waves ?? [],
          stage: t.stage,
        })
      )
    }
    return map
  }, [tables, liveDetailByTableId])

  let filteredByMode = filterTablesByMode(tables, filterMode, currentServer)
  if (sectionFilter) {
    filteredByMode = filteredByMode.filter((t) => t.section === sectionFilter)
  }
  const displayTables = React.useMemo(() => {
    if (!statusFilter) return filteredByMode
    return filteredByMode.filter((t) => tableColorById.get(t.id) === statusFilter)
  }, [filteredByMode, statusFilter, tableColorById])

  const visibleTableIds = React.useMemo(() => new Set(displayTables.map((t) => t.id)), [displayTables])

  const counts = React.useMemo(() => {
    const base: Record<TableColorState, number> = {
      available: 0,
      reserved: 0,
      occupied: 0,
      food_ready: 0,
      bill_requested: 0,
      needs_attention: 0,
      cleaning: 0,
    }
    for (const t of filteredByMode) {
      const s = tableColorById.get(t.id)
      if (s) base[s] += 1
    }
    return base
  }, [filteredByMode, tableColorById])

  const activeFilterChips: string[] = []
  if (filterMode !== "all") {
    activeFilterChips.push(
      filterMode === "my_section"
        ? `Section: ${sectionConfig[currentServer.section]?.name ?? currentServer.section}`
        : `My Tables (${currentServer.assignedTables.length})`
    )
  }
  if (sectionFilter) {
    activeFilterChips.push(sectionConfig[sectionFilter]?.name ?? sectionFilter)
  }
  if (statusFilter) {
    activeFilterChips.push(TABLE_COLOR_STATES[statusFilter].label)
  }

  const handleClearAllFilters = useCallback(() => {
    setFilterMode("all")
    setStatusFilter(null)
    setSectionFilter(null)
  }, [])

  const animateTransition = useCallback(
    (
      targetScale: number,
      targetOffset: { x: number; y: number },
      duration?: number
    ) => {
      const dur = getAnimatedDuration(
        duration ?? DURATIONS.zoomIn,
        windowWidth,
        reducedMotion
      )
      setIsTransitioning(true)
      setScale(targetScale)
      setOffset(targetOffset)
      setTimeout(() => setIsTransitioning(false), dur)
    },
    [windowWidth, reducedMotion]
  )

  const handleFitToScreen = useCallback(() => {
    const PADDING = 32
    const containerWidth = windowWidth
    const containerHeight =
      mapContainerRef.current?.clientHeight ??
      (typeof window !== "undefined" ? window.innerHeight - 104 : 600)

    let minX: number, minY: number, maxX: number, maxY: number
    if (floorplanElements.length > 0) {
      minX = Math.min(...floorplanElements.map((e) => e.x))
      minY = Math.min(...floorplanElements.map((e) => e.y))
      maxX = Math.max(...floorplanElements.map((e) => e.x + e.width))
      maxY = Math.max(...floorplanElements.map((e) => e.y + e.height))
    } else if (tables.length > 0) {
      const w = (t: { position: { x: number; y: number }; width?: number; height?: number }) => t.width ?? 64
      const h = (t: { position: { x: number; y: number }; width?: number; height?: number }) => t.height ?? 64
      minX = Math.min(...tables.map((t) => t.position.x))
      minY = Math.min(...tables.map((t) => t.position.y))
      maxX = Math.max(...tables.map((t) => t.position.x + w(t)))
      maxY = Math.max(...tables.map((t) => t.position.y + h(t)))
    } else {
      return
    }

    const contentWidth = maxX - minX
    const contentHeight = maxY - minY

    if (contentWidth <= 0 || contentHeight <= 0) return

    const viewW = containerWidth - PADDING * 2
    const viewH = containerHeight - PADDING * 2

    const targetScale = Math.min(viewW / contentWidth, viewH / contentHeight)

    const containerCenterX = containerWidth / 2
    const containerCenterY = containerHeight / 2
    const contentCenterX = minX + contentWidth / 2
    const contentCenterY = minY + contentHeight / 2

    const targetOffset = {
      x: containerCenterX - containerCenterX * (1 - targetScale) - contentCenterX * targetScale,
      y: containerCenterY - containerCenterY * (1 - targetScale) - contentCenterY * targetScale,
    }

    animateTransition(targetScale, targetOffset, DURATIONS.zoomIn)
  }, [floorplanElements, tables, windowWidth, animateTransition])

  useEffect(() => {
    if (floorplanElements.length > 0 || tables.length > 0) {
      const timer = setTimeout(() => handleFitToScreen(), 100)
      return () => clearTimeout(timer)
    }
  }, [floorplanElements, tables, handleFitToScreen])

  useEffect(() => {
    if (floorplanElements.length === 0 && tables.length === 0) return
    const onResize = () => handleFitToScreen()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [floorplanElements, tables, handleFitToScreen])

  const handleZoomIn = useCallback(() => {
    if (scale < ZOOM_LEVELS.level2.scale) {
      animateTransition(ZOOM_LEVELS.level2.scale, { x: 0, y: 0 }, DURATIONS.zoomIn)
    }
  }, [scale, animateTransition])

  const handleZoomOut = useCallback(() => {
    if (scale > ZOOM_LEVELS.level1.scale) {
      animateTransition(ZOOM_LEVELS.level1.scale, { x: 0, y: 0 }, DURATIONS.zoomOut)
    }
  }, [scale, animateTransition])

  const handleScaleChange = useCallback(
    (newScale: number) => setScale(newScale),
    []
  )
  const handleOffsetChange = useCallback(
    (newOffset: { x: number; y: number }) => setOffset(newOffset),
    []
  )

  const handleTableTap = useCallback(
    (tableId: string) => {
      const table = tables.find((t) => t.id === tableId)
      if (table?.status === "closed") {
        setQuickAction({
          tableId: table.id,
          tableNumber: table.number,
          position: {
            x: typeof window !== "undefined" ? window.innerWidth / 2 - 112 : 0,
            y: typeof window !== "undefined" ? window.innerHeight / 2 - 140 : 0,
          },
          isCleaning: true,
        })
        return
      }

      const base = `/table/${encodeURIComponent(tableId)}`
      const href =
        selectedFloorplanId && selectedFloorplanId !== ""
          ? `${base}?floorplan=${encodeURIComponent(selectedFloorplanId)}`
          : base
      setNavigatingTableId(tableId)
      startTransition(() => {
        router.push(href)
      })
    },
    [router, selectedFloorplanId, tables]
  )

  const prefetchTable = useCallback(
    (tableId: string) => {
      const base = `/table/${encodeURIComponent(tableId)}`
      const href =
        selectedFloorplanId && selectedFloorplanId !== ""
          ? `${base}?floorplan=${encodeURIComponent(selectedFloorplanId)}`
          : base
      prefetchRoute(href, router)
    },
    [router, selectedFloorplanId]
  )

  const handleOpenSeatParty = useCallback((preSelectTableId?: string) => {
    setSeatPartyPreSelect(preSelectTableId ?? null)
    setSeatPartyOpen(true)
  }, [])

  const handleSeatPartyClose = useCallback(() => {
    setSeatPartyOpen(false)
    setSeatPartyPreSelect(null)
  }, [])

  const handlePartySeated = useCallback(
    (formData: SeatPartyForm) => {
      if (!formData.tableId || !currentLocationId) return Promise.resolve(false)

      return seatParty({
        tableId: formData.tableId,
        partySize: formData.partySize,
        locationId: currentLocationId,
        serverId: currentServer.id,
        background: true,
      })
    },
    [currentLocationId, currentServer.id, seatParty]
  )

  const handleViewTable = useCallback(
    (tableId: string) => {
      handleSeatPartyClose()
      handleTableTap(tableId)
    },
    [handleSeatPartyClose, handleTableTap]
  )

  const handleTableLongPress = useCallback(
    (tableId: string, e: React.MouseEvent | React.TouchEvent) => {
      const table = tables.find((t) => t.id === tableId)
      if (!table) return
      let x = 0
      let y = 0
      if ("clientX" in e) {
        x = e.clientX
        y = e.clientY
      } else if ("touches" in e && e.touches.length > 0) {
        x = e.touches[0].clientX
        y = e.touches[0].clientY
      }
      setQuickAction({
        tableId: table.id,
        tableNumber: table.number,
        position: { x, y },
        isCleaning: table.status === "closed",
        hasWaiterRequest: hasWaiterRequestAlert(table.alerts),
        hasBillRequest: hasBillRequest(table.stage),
      })
    },
    [tables]
  )

  const handleSectionFocus = useCallback(
    (sectionId: SectionId | null) => {
      if (sectionId === focusedSection) {
        setFocusedSection(null)
        animateTransition(ZOOM_LEVELS.level1.scale, { x: 0, y: 0 }, DURATIONS.zoomOut)
        return
      }

      if (sectionId === null) {
        setFocusedSection(null)
        animateTransition(ZOOM_LEVELS.level1.scale, { x: 0, y: 0 }, DURATIONS.zoomOut)
        return
      }

      const bounds = getSectionBounds(sectionId, tables)
      if (!bounds) return

      setFocusedSection(sectionId)
      setViewMode("map")

      const windowHeight = typeof window !== "undefined" ? window.innerHeight : 800
      const sectionWidth = bounds.width + 100
      const sectionHeight = bounds.height + 100
      const scaleX = (windowWidth * 0.85) / sectionWidth
      const scaleY = ((windowHeight - 200) * 0.85) / sectionHeight
      const targetScale = Math.min(scaleX, scaleY, ZOOM_LEVELS.level2.scale)

      const sectionCenterX = bounds.x + bounds.width / 2
      const sectionCenterY = bounds.y + bounds.height / 2
      const targetOffset = {
        x: -(sectionCenterX * targetScale - windowWidth / 2),
        y: -(sectionCenterY * targetScale - windowHeight / 2 + 50),
      }

      animateTransition(targetScale, targetOffset, DURATIONS.sectionPan)
    },
    [windowWidth, animateTransition, focusedSection]
  )

  const handleSearchSelect = useCallback(
    (tableId: string) => {
      setViewMode("map")
      setHighlightType("search")
      setHighlightedTableId(tableId)
      const tableCenter = getTableCenter(tableId, tables)
      if (tableCenter) {
        const targetScale = ZOOM_LEVELS.level2.scale
        const targetOffset = {
          x: -(tableCenter.x * targetScale - windowWidth / 2),
          y: -(tableCenter.y * targetScale - 300),
        }
        animateTransition(targetScale, targetOffset, DURATIONS.searchJump)
      }
      setTimeout(() => {
        setHighlightedTableId(null)
        setHighlightType(null)
      }, 2500)
    },
    [windowWidth, animateTransition]
  )

  const handleViewModeChange = useCallback(
    (newMode: ViewMode) => {
      if (newMode === viewMode) return
      if (reducedMotion) {
        setViewMode(newMode)
        return
      }
      if (newMode === "map") {
        setViewTransition("grid-exit")
        setTimeout(() => {
          setViewMode("map")
          setViewTransition("map-enter")
          setMapEntering(true)
          setTimeout(() => {
            setViewTransition("none")
            setMapEntering(false)
          }, 250)
        }, 150)
      } else {
        setViewTransition("map-exit")
        setTimeout(() => {
          setViewMode("grid")
          setViewTransition("grid-enter")
          setTimeout(() => setViewTransition("none"), 250)
        }, 150)
      }
    },
    [viewMode, reducedMotion]
  )

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return

      if (e.key === "=" || e.key === "+") { e.preventDefault(); handleZoomIn() }
      else if (e.key === "-") { e.preventDefault(); handleZoomOut() }
      else if (e.key === "0") {
        e.preventDefault()
        animateTransition(ZOOM_LEVELS.level1.scale, { x: 0, y: 0 }, DURATIONS.zoomOut)
      }
      else if (e.key === "g" || e.key === "G") { e.preventDefault(); handleViewModeChange("grid") }
      else if (e.key === "m" || e.key === "M") { e.preventDefault(); handleViewModeChange("map") }
      else if (e.key === "u" || e.key === "U") { e.preventDefault(); setStatusFilter((p) => (p === "urgent" ? null : "urgent")) }
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); setStatusFilter((p) => (p === "free" ? null : "free")) }
      else if (e.key === "a" || e.key === "A") { e.preventDefault(); handleClearAllFilters() }
      else if (e.key === "ArrowLeft") { e.preventDefault(); setOffset((prev) => ({ ...prev, x: prev.x + 50 })) }
      else if (e.key === "ArrowRight") { e.preventDefault(); setOffset((prev) => ({ ...prev, x: prev.x - 50 })) }
      else if (e.key === "ArrowUp") { e.preventDefault(); setOffset((prev) => ({ ...prev, y: prev.y + 50 })) }
      else if (e.key === "ArrowDown") { e.preventDefault(); setOffset((prev) => ({ ...prev, y: prev.y - 50 })) }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleZoomIn, handleZoomOut, handleViewModeChange, handleClearAllFilters, animateTransition])

  const showGridExiting = viewTransition === "grid-exit" || viewTransition === "map-enter"
  const showMapExiting = viewTransition === "map-exit" || viewTransition === "grid-enter"

  const showSkeleton =
    !locationIdResolved ||
    (locationIdResolved &&
      currentLocationId &&
      (viewLoading || (view === null && !viewError)))
  const showNoLocation = locationIdResolved && !currentLocationId
  const showError = Boolean(viewError)
  const isReady =
    locationIdResolved && Boolean(currentLocationId) && view !== null && !viewError

  if (showSkeleton) {
    return <FloorMapPageSkeleton />
  }
  if (showNoLocation) {
    return <FloorMapNoLocationState />
  }
  if (showError) {
    return (
      <FloorMapErrorState
        message={viewError ?? "Failed to load floor map"}
        onRetry={() => void refresh()}
      />
    )
  }

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      {staleError && (
        <FloorMapStaleBanner message={staleError} onRetry={() => void refresh()} />
      )}
      <MapTopBar
        sectionConfig={sectionConfig}
        filterMode={filterMode}
        viewMode={viewMode}
        serverSection={currentServer.section}
        tables={tables}
        statusFilter={statusFilter}
        sectionFilter={sectionFilter}
        activeFilterChips={activeFilterChips}
        ownTableIds={currentServer.assignedTables}
        allFloorplans={allFloorplans}
        activeFloorplanId={displayActiveFloorplanId}
        onFilterModeChange={setFilterMode}
        onViewModeChange={handleViewModeChange}
        onTableSelect={handleSearchSelect}
        onStatusFilterChange={setStatusFilter}
        onSectionFilterChange={setSectionFilter}
        onClearAllFilters={handleClearAllFilters}
        onFloorplanChange={handleFloorplanIdChange}
      />

      <MapStatsBar
        counts={counts}
        activeStatusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
      />

      {planViewPending && (
        <div
          className="shrink-0 px-4 py-1.5 text-center text-sm bg-muted/80 text-muted-foreground border-b border-border"
          role="status"
          aria-live="polite"
        >
          Loading selected floor plan…
        </div>
      )}

      <div className="relative flex-1 min-h-0" ref={mapContainerRef}>
        {viewMode === "map" ? (
          <div
            className={
              viewTransition === "map-enter"
                ? "animate-map-enter h-full overflow-hidden flex items-center justify-center"
                : showMapExiting
                  ? "animate-map-exit h-full overflow-hidden flex items-center justify-center"
                  : "h-full overflow-hidden flex items-center justify-center"
            }
          >
            <div className="relative h-full w-full max-w-[1600px]">
              <MapCanvas
                sectionConfig={sectionConfig}
                tables={displayTables}
                allTablesForScene={tables}
                visibleTableIds={visibleTableIds}
                tableColorById={tableColorById}
                liveDetailByTableId={liveDetailByTableId}
                currentServerId={currentServer.id}
                ownTableIds={currentServer.assignedTables}
                filterMode={filterMode}
                highlightedTableId={highlightedTableId}
                highlightType={highlightType}
                statusFilter={statusFilter}
                onTableTap={handleTableTap}
                onTablePrefetch={prefetchTable}
                onTableLongPress={handleTableLongPress}
                onScaleChange={handleScaleChange}
                scale={scale}
                offset={offset}
                onOffsetChange={handleOffsetChange}
                isTransitioning={isTransitioning}
                focusedTableId={null}
                focusedSection={focusedSection}
                onSectionTap={handleSectionFocus}
                entering={mapEntering}
                floorplanElements={floorplanElements}
                onFitToScreen={handleFitToScreen}
              />
            </div>
          </div>
        ) : (
          <div
            className={
              viewTransition === "grid-enter"
                ? "animate-grid-enter h-full"
                : showGridExiting
                  ? "animate-grid-exit h-full"
                  : "h-full"
            }
          >
            <GridView
              sectionConfig={sectionConfig}
              tables={displayTables}
              liveDetailByTableId={liveDetailByTableId}
              currentServerId={currentServer.id}
              ownTableIds={currentServer.assignedTables}
              onTableTap={handleTableTap}
              onTablePrefetch={prefetchTable}
              onMarkAvailable={(tableId) => {
                void markTableAvailable(tableId)
              }}
              onAcknowledgeService={(tableId, requestType) => {
                void acknowledgeService(tableId, requestType)
              }}
            />
          </div>
        )}
      </div>

      {quickAction && (
        <QuickActionsMenu
          tableNumber={quickAction.tableNumber}
          position={quickAction.position}
          isCleaning={quickAction.isCleaning}
          hasWaiterRequest={quickAction.hasWaiterRequest}
          hasBillRequest={quickAction.hasBillRequest}
          onClose={() => setQuickAction(null)}
          onSeatParty={() => {
            setQuickAction(null)
            handleOpenSeatParty(quickAction.tableId)
          }}
          onMarkAvailable={() => {
            void markTableAvailable(quickAction.tableId)
          }}
          onAcknowledgeService={(requestType) => {
            void acknowledgeService(quickAction.tableId, requestType)
          }}
        />
      )}

      <div className="fixed top-20 left-4 z-50">
        <FloorplanSelector
          allFloorplans={view?.allFloorplans}
          activeFloorplanId={displayActiveFloorplanId}
          onFloorplanChange={handleFloorplanChange}
        />
      </div>

      {focusedSection && viewMode === "map" && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className="glass-surface-strong rounded-2xl px-5 py-3 shadow-2xl border border-primary/30 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <p className="text-sm font-medium">
                  Viewing <span className="text-primary font-semibold">{sectionConfig[focusedSection]?.name ?? focusedSection}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSectionFocus(null)}
                className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
              >
                Show all
              </button>
            </div>
          </div>
        </div>
      )}

      {navigatingTableId && (
        <div className="fixed top-20 right-4 z-50 rounded-full border border-primary/30 bg-[hsl(224,18%,12%)]/92 px-3 py-2 text-xs font-medium text-primary shadow-xl backdrop-blur-xl">
          Opening table T{view?.tables.find((t) => t.id === navigatingTableId)?.number ?? ""}
          ...
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
        <Link
          href="/builder"
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground border border-border shadow-lg hover:bg-secondary/80 active:scale-95 transition-all"
          aria-label="Open floor plan builder"
        >
          <Hammer className="h-5 w-5" strokeWidth={2} />
        </Link>
        <button
          type="button"
          onClick={() => handleOpenSeatParty()}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all"
          aria-label="Seat new party"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      </div>

      <SeatPartyModal
        sectionConfig={sectionConfig}
        currentServer={currentServer}
        open={seatPartyOpen}
        tables={tables}
        preSelectedTableId={seatPartyPreSelect}
        onClose={handleSeatPartyClose}
        onSeated={handlePartySeated}
        onViewTable={handleViewTable}
      />
    </div>
  )
}
