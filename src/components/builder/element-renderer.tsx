"use client"

import type { PlacedElement } from "@/lib/floorplan-types"

// Helper: render a top-down chair facing a direction
// A chair is a rectangle (seat) with a thicker bar (backrest) on the "back" side
function Chair({ x, y, size, facingAngle }: { x: number; y: number; size: number; facingAngle: number }) {
  return (
    <g transform={`rotate(${facingAngle}, ${x}, ${y})`}>
      {/* backrest - thicker bar at top */}
      <rect
        x={x - size * 0.5}
        y={y - size * 0.55}
        width={size}
        height={size * 0.28}
        rx={size * 0.1}
        fill="hsl(220, 18%, 30%)"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="0.8"
      />
      {/* seat */}
      <rect
        x={x - size * 0.42}
        y={y - size * 0.22}
        width={size * 0.84}
        height={size * 0.7}
        rx={size * 0.12}
        fill="hsl(220, 15%, 25%)"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.8"
      />
      {/* cushion highlight */}
      <ellipse
        cx={x}
        cy={y + size * 0.05}
        rx={size * 0.22}
        ry={size * 0.18}
        fill="rgba(255,255,255,0.06)"
      />
    </g>
  )
}

// Returns an inline SVG for each element type, sized to fill its container
// The viewBox is expanded by `pad` on all sides so chairs etc. are never clipped.
// chairCountOverride: when provided (floor map view mode), show this many chairs instead of element.seats.
// Used to show guests when occupied, full capacity when available.
export function ElementRenderer({
  element,
  width,
  height,
  colorOverride,
  chairCountOverride,
}: {
  element: PlacedElement
  width: number
  height: number
  colorOverride?: string
  /** Override chair count for floor map: guests when occupied, capacity when available */
  chairCountOverride?: number
}) {
  const id = element.templateId
  const c = colorOverride ?? element.color

  // Shared
  const glow = "drop-shadow(0 0 6px rgba(255,255,255,0.12))"

  // Padding for elements that have stuff outside bounds (tables with chairs)
  const needsPad = (id.startsWith("table-") && !id.includes("coffee")) || id === "bar-counter" || id === "bar-corner" || id === "bar-corner-left" || id === "bar-curved"
  const pad = needsPad ? Math.max(14, Math.min(width, height) * 0.16) : 0
  const vw = width + pad * 2
  const vh = height + pad * 2
  // Offset: everything is drawn offset by `pad` so 0,0 of the element maps to pad,pad in viewBox
  const ox = pad
  const oy = pad

  // ── ROUND TABLES ───────────────────────────────────
  if (id.startsWith("table-round")) {
    const seats = chairCountOverride ?? element.seats ?? 4
    const cx = ox + width / 2
    const cy = oy + height / 2
    const tableR = Math.min(width, height) / 2 - 4
    const chairSize = Math.min(14, tableR * 0.4)
    const chairDist = tableR + chairSize * 0.45 + 1

    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} width={width} height={height} className="block" style={{ filter: glow, overflow: "visible" }}>
        {/* chairs */}
        {Array.from({ length: seats }).map((_, i) => {
          const angle = (i / seats) * Math.PI * 2 - Math.PI / 2
          const px = cx + Math.cos(angle) * chairDist
          const py = cy + Math.sin(angle) * chairDist
          const facing = (angle * 180) / Math.PI + 90
          return <Chair key={i} x={px} y={py} size={chairSize} facingAngle={facing} />
        })}
        {/* table surface */}
        <circle cx={cx} cy={cy} r={tableR} fill={c} stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={tableR - 6} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* napkin/plate indicators */}
        {seats > 0 && Array.from({ length: seats }).map((_, i) => {
          const angle = (i / seats) * Math.PI * 2 - Math.PI / 2
          const pr = tableR - 14
          const px = cx + Math.cos(angle) * pr
          const py = cy + Math.sin(angle) * pr
          return <circle key={`p${i}`} cx={px} cy={py} r={Math.min(4, tableR * 0.12)} fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        })}
      </svg>
    )
  }

  // ── OVAL TABLE ─────────────────────────────────────
  if (id.startsWith("table-oval")) {
    const seats = chairCountOverride ?? element.seats ?? 6
    const cx = ox + width / 2
    const cy = oy + height / 2
    const rx = width / 2 - 4
    const ry = height / 2 - 4
    const chairSize = Math.min(14, Math.min(rx, ry) * 0.35)
    const chairGap = chairSize * 0.45 + 1

    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} width={width} height={height} className="block" style={{ filter: glow, overflow: "visible" }}>
        {/* chairs evenly spaced around ellipse */}
        {Array.from({ length: seats }).map((_, i) => {
          const angle = (i / seats) * Math.PI * 2 - Math.PI / 2
          // Point on the ellipse edge
          const edgeX = rx * Math.cos(angle)
          const edgeY = ry * Math.sin(angle)
          // Normal direction outward from ellipse at this angle
          const nx = edgeX / (rx * rx)
          const ny = edgeY / (ry * ry)
          const nLen = Math.sqrt(nx * nx + ny * ny)
          const px = cx + edgeX + (nx / nLen) * chairGap
          const py = cy + edgeY + (ny / nLen) * chairGap
          const facing = (Math.atan2(ny, nx) * 180) / Math.PI + 90
          return <Chair key={i} x={px} y={py} size={chairSize} facingAngle={facing} />
        })}
        {/* table */}
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={c} stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
        <ellipse cx={cx} cy={cy} rx={rx - 8} ry={ry - 6} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      </svg>
    )
  }

  // ── SQUARE / RECTANGULAR / BANQUET TABLES ──────────
  if (id.startsWith("table-square") || id.startsWith("table-rect") || id.startsWith("table-long")) {
    const seats = chairCountOverride ?? element.seats ?? 4
    const cx = ox
    const cy = oy
    const chairSize = Math.min(14, Math.min(width, height) * 0.2)
    // Chair seat extends chairSize*0.48 from center toward table. Table border is 4px inset.
    // Place chair center so seat edge touches the table border.
    const chairOffset = chairSize * 0.2

    const isSquare = Math.abs(width - height) < 20
    const chairs: { x: number; y: number; facing: number }[] = []

    if (isSquare) {
      // Square tables: distribute across all 4 sides
      if (seats <= 2) {
        // 1-2 seats: place on top and bottom only
        if (seats >= 1) chairs.push({ x: cx + width / 2, y: cy - chairOffset, facing: 180 })
        if (seats >= 2) chairs.push({ x: cx + width / 2, y: cy + height + chairOffset, facing: 0 })
      } else if (seats === 3) {
        chairs.push({ x: cx + width / 2, y: cy - chairOffset, facing: 180 })
        chairs.push({ x: cx + width / 2, y: cy + height + chairOffset, facing: 0 })
        chairs.push({ x: cx - chairOffset, y: cy + height / 2, facing: 90 })
      } else {
        // 4+: distribute evenly across all sides
        const perSide = Math.floor(seats / 4)
        const remainder = seats - perSide * 4
        const top = perSide + (remainder >= 1 ? 1 : 0)
        const bottom = perSide + (remainder >= 2 ? 1 : 0)
        const left = perSide + (remainder >= 3 ? 1 : 0)
        const right = perSide

        for (let i = 0; i < top; i++) {
          const along = 14 + ((width - 28) / top) * (i + 0.5)
          chairs.push({ x: cx + along, y: cy - chairOffset, facing: 180 })
        }
        for (let i = 0; i < bottom; i++) {
          const along = 14 + ((width - 28) / bottom) * (i + 0.5)
          chairs.push({ x: cx + along, y: cy + height + chairOffset, facing: 0 })
        }
        for (let i = 0; i < left; i++) {
          const along = 14 + ((height - 28) / left) * (i + 0.5)
          chairs.push({ x: cx - chairOffset, y: cy + along, facing: 90 })
        }
        for (let i = 0; i < right; i++) {
          const along = 14 + ((height - 28) / right) * (i + 0.5)
          chairs.push({ x: cx + width + chairOffset, y: cy + along, facing: 270 })
        }
      }
    } else {
      // Rectangular/banquet: top + bottom primarily, left/right for overflow
      const perLong = Math.min(seats, Math.max(1, Math.ceil(seats / 2)))
      // Top edge
      for (let i = 0; i < perLong && chairs.length < seats; i++) {
        const along = 14 + ((width - 28) / perLong) * (i + 0.5)
        chairs.push({ x: cx + along, y: cy - chairOffset, facing: 180 })
      }
      // Bottom edge
      for (let i = 0; i < perLong && chairs.length < seats; i++) {
        const along = 14 + ((width - 28) / perLong) * (i + 0.5)
        chairs.push({ x: cx + along, y: cy + height + chairOffset, facing: 0 })
      }
      // Left edge
      if (chairs.length < seats) {
        const perShort = Math.ceil((seats - chairs.length) / 2)
        for (let i = 0; i < perShort && chairs.length < seats; i++) {
          const along = 14 + ((height - 28) / perShort) * (i + 0.5)
          chairs.push({ x: cx - chairOffset, y: cy + along, facing: 90 })
        }
      }
      // Right edge
      if (chairs.length < seats) {
        const perShort = seats - chairs.length
        for (let i = 0; i < perShort && chairs.length < seats; i++) {
          const along = 14 + ((height - 28) / perShort) * (i + 0.5)
          chairs.push({ x: cx + width + chairOffset, y: cy + along, facing: 270 })
        }
      }
    }

    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} width={width} height={height} className="block" style={{ filter: glow, overflow: "visible" }}>
        {/* chairs */}
        {chairs.map((ch, i) => (
          <Chair key={i} x={ch.x} y={ch.y} size={chairSize} facingAngle={ch.facing} />
        ))}
        {/* table surface */}
        <rect x={cx + 4} y={cy + 4} width={width - 8} height={height - 8} rx={4} fill={c} stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
        <rect x={cx + 8} y={cy + 8} width={width - 16} height={height - 16} rx={2} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* place settings */}
        {chairs.map((ch, i) => {
          // Place a plate on the table near each chair
          const plateX = Math.max(cx + 12, Math.min(cx + width - 12, ch.x))
          const plateY = Math.max(cy + 12, Math.min(cy + height - 12, ch.y > cy + height / 2 ? cy + height - 14 : cy + 14))
          return <circle key={`pl${i}`} cx={plateX} cy={plateY} r={Math.min(4, chairSize * 0.3)} fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        })}
      </svg>
    )
  }

  // ── COCKTAIL / HIGHBOY TABLES ──────────────────────
  if (id === "table-cocktail" || id === "table-highboy") {
    const cx = ox + width / 2
    const cy = oy + height / 2
    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} width={width} height={height} className="block" style={{ filter: glow, overflow: "visible" }}>
        {/* outer ring shadow */}
        <circle cx={cx} cy={cy} r={width / 2 - 1} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* surface */}
        <circle cx={cx} cy={cy} r={width / 2 - 3} fill={c} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        {/* beveled edge */}
        <circle cx={cx} cy={cy} r={width / 2 - 6} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
        {/* center pedestal */}
        <circle cx={cx} cy={cy} r={width * 0.15} fill="rgba(0,0,0,0.2)" />
        <circle cx={cx} cy={cy} r={2} fill="rgba(255,255,255,0.2)" />
      </svg>
    )
  }

  // ── COUNTER TABLE ──────────────────────────────────
  if (id === "table-counter") {
    const seats = chairCountOverride ?? element.seats ?? 4
    const cx = ox
    const cy = oy
    const chairSize = Math.min(12, width / (seats + 1) * 0.7)
    const stoolOffset = chairSize * 0.2

    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} width={width} height={height} className="block" style={{ filter: glow, overflow: "visible" }}>
        {/* stools along bottom */}
        {Array.from({ length: seats }).map((_, i) => {
          const px = cx + 10 + ((width - 20) / seats) * (i + 0.5)
          return (
            <g key={i}>
              <circle cx={px} cy={cy + height + stoolOffset} r={chairSize * 0.5} fill="hsl(220, 15%, 25%)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
              <circle cx={px} cy={cy + height + stoolOffset} r={chairSize * 0.2} fill="rgba(255,255,255,0.08)" />
            </g>
          )
        })}
        {/* counter surface */}
        <rect x={cx + 3} y={cy + 3} width={width - 6} height={height - 6} rx={3} fill={c} stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
        <rect x={cx + 6} y={cy + 6} width={width - 12} height={height - 12} rx={2} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      </svg>
    )
  }

  // ── COFFEE TABLE ───────────────────────────────────
  if (id === "table-coffee") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={4} y={4} width={width - 8} height={height - 8} rx={8} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <rect x={width * 0.25} y={height * 0.25} width={width * 0.5} height={height * 0.5} rx={4} fill="rgba(255,255,255,0.06)" />
        {/* wood grain */}
        <line x1={12} y1={height * 0.4} x2={width - 12} y2={height * 0.4} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
        <line x1={12} y1={height * 0.6} x2={width - 12} y2={height * 0.6} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      </svg>
    )
  }

  // ── KIDS TABLE ─────────────────────────────────────
  if (id === "table-kids") {
    const seats = chairCountOverride ?? element.seats ?? 4
    const cx = ox + width / 2
    const cy = oy + height / 2
    const chairSize = Math.min(14, Math.min(width, height) * 0.2)
    const chairOffset = chairSize * 0.2

    // Place chairs evenly around the table like round tables
    const chairs: { x: number; y: number; facing: number }[] = []
    if (seats >= 1) chairs.push({ x: cx, y: cy - height / 2 - chairOffset, facing: 180 })
    if (seats >= 2) chairs.push({ x: cx, y: cy + height / 2 + chairOffset, facing: 0 })
    if (seats >= 3) chairs.push({ x: cx - width / 2 - chairOffset, y: cy, facing: 90 })
    if (seats >= 4) chairs.push({ x: cx + width / 2 + chairOffset, y: cy, facing: 270 })

    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} width={width} height={height} className="block" style={{ filter: glow, overflow: "visible" }}>
        {chairs.map((p, i) => (
          <Chair key={i} x={p.x} y={p.y} size={chairSize} facingAngle={p.facing} />
        ))}
        <rect x={ox + 4} y={oy + 4} width={width - 8} height={height - 8} rx={10} fill={c} stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
        <rect x={ox + 8} y={oy + 8} width={width - 16} height={height - 16} rx={7} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      </svg>
    )
  }

  // ── SEATING: CHAIRS ────────────────────────────────
  if (id === "chair" || id === "chair-dining" || id === "waiting-chair") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        {/* backrest */}
        <rect x={3} y={2} width={width - 6} height={height * 0.28} rx={3} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1" opacity={0.85} />
        {/* seat */}
        <rect x={2} y={height * 0.28} width={width - 4} height={height * 0.65} rx={3} fill={c} stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
        {/* cushion */}
        <ellipse cx={width / 2} cy={height * 0.55} rx={width * 0.22} ry={height * 0.15} fill="rgba(255,255,255,0.07)" />
      </svg>
    )
  }

  if (id === "chair-accent") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        {/* armrests */}
        <rect x={1} y={height * 0.15} width={width * 0.14} height={height * 0.72} rx={3} fill={c} opacity={0.7} />
        <rect x={width * 0.86} y={height * 0.15} width={width * 0.14} height={height * 0.72} rx={3} fill={c} opacity={0.7} />
        {/* back */}
        <path d={`M ${width * 0.16} 3 Q ${width / 2} 0 ${width * 0.84} 3 L ${width * 0.84} ${height * 0.35} L ${width * 0.16} ${height * 0.35} Z`}
          fill={c} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        {/* seat */}
        <rect x={width * 0.13} y={height * 0.33} width={width * 0.74} height={height * 0.55} rx={4} fill={c} stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <ellipse cx={width / 2} cy={height * 0.58} rx={width * 0.2} ry={height * 0.12} fill="rgba(255,255,255,0.06)" />
      </svg>
    )
  }

  if (id === "chair-lounge") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        {/* reclined back */}
        <path d={`M ${width * 0.1} 3 Q ${width / 2} 0 ${width * 0.9} 3 L ${width * 0.85} ${height * 0.4} L ${width * 0.15} ${height * 0.4} Z`}
          fill={c} stroke="rgba(255,255,255,0.12)" strokeWidth="1" opacity={0.85} />
        {/* arms */}
        <rect x={0} y={height * 0.1} width={width * 0.12} height={height * 0.82} rx={4} fill={c} opacity={0.6} />
        <rect x={width * 0.88} y={height * 0.1} width={width * 0.12} height={height * 0.82} rx={4} fill={c} opacity={0.6} />
        {/* seat */}
        <rect x={width * 0.1} y={height * 0.36} width={width * 0.8} height={height * 0.56} rx={5} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <rect x={width * 0.18} y={height * 0.45} width={width * 0.64} height={height * 0.3} rx={3} fill="rgba(255,255,255,0.05)" />
      </svg>
    )
  }

  // ── BOOTHS ─�����─────────────────────────���─────────────
  if (id.startsWith("booth")) {
    const isCorner = id === "booth-corner"
    if (isCorner) {
      return (
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
          {/* L-shaped back */}
          <path d={`M 2 2 L ${width - 4} 2 L ${width - 4} ${height * 0.18} L ${width * 0.18} ${height * 0.18} L ${width * 0.18} ${height - 4} L 2 ${height - 4} Z`}
            fill={c} stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
          {/* tufting lines on top back */}
          {Array.from({ length: Math.max(2, Math.floor((width * 0.8) / 28)) }).map((_, i) => {
            const x = width * 0.2 + ((width * 0.78 - width * 0.2) / Math.max(2, Math.floor((width * 0.8) / 28))) * (i + 0.5)
            return <line key={`t${i}`} x1={x} y1={3} x2={x} y2={height * 0.16} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          })}
          {/* tufting lines on left back */}
          {Array.from({ length: Math.max(2, Math.floor((height * 0.8) / 28)) }).map((_, i) => {
            const y = height * 0.2 + ((height * 0.78 - height * 0.2) / Math.max(2, Math.floor((height * 0.8) / 28))) * (i + 0.5)
            return <line key={`l${i}`} x1={3} y1={y} x2={width * 0.16} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          })}
          {/* seat cushion */}
          <rect x={width * 0.2} y={height * 0.2} width={width * 0.72} height={height * 0.72} rx={6}
            fill={c} opacity={0.6} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        </svg>
      )
    }
    // Standard booth
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        {/* back cushion */}
        <rect x={2} y={2} width={width - 4} height={height * 0.3} rx={4} fill={c} stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
        {/* tufting lines */}
        {Array.from({ length: Math.max(2, Math.floor(width / 35)) }).map((_, i) => {
          const x = 10 + ((width - 20) / Math.max(2, Math.floor(width / 35))) * (i + 0.5)
          return <line key={i} x1={x} y1={4} x2={x} y2={height * 0.28} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        })}
        {/* seat cushion */}
        <rect x={3} y={height * 0.32} width={width - 6} height={height * 0.6} rx={4} fill={c} opacity={0.7} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        {/* cushion piping */}
        <line x1={6} y1={height * 0.62} x2={width - 6} y2={height * 0.62} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      </svg>
    )
  }

  if (id === "bar-stool") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        {/* footrest ring */}
        <circle cx={width / 2} cy={height / 2} r={width / 2 - 1} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        {/* seat */}
        <circle cx={width / 2} cy={height / 2} r={width / 2 - 3} fill={c} stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
        {/* highlight */}
        <circle cx={width / 2} cy={height / 2} r={width * 0.18} fill="rgba(255,255,255,0.08)" />
      </svg>
    )
  }

  if (id === "bench" || id === "bench-long") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={4} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        {/* slats */}
        {Array.from({ length: Math.max(3, Math.floor(width / 25)) }).map((_, i) => {
          const x = 6 + ((width - 12) / Math.max(3, Math.floor(width / 25))) * i
          return <line key={i} x1={x} y1={4} x2={x} y2={height - 4} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        })}
      </svg>
    )
  }

  if (id.startsWith("sofa") || id === "sofa-sectional") {
    if (id === "sofa-sectional") {
      return (
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
          {/* L-shaped sofa */}
          <path d={`M 4 4 L ${width - 4} 4 L ${width - 4} ${height * 0.45} L ${width * 0.45} ${height * 0.45} L ${width * 0.45} ${height - 4} L 4 ${height - 4} Z`}
            fill={c} stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
          {/* back */}
          <rect x={4} y={4} width={width - 8} height={height * 0.12} rx={3} fill="rgba(255,255,255,0.08)" />
          <rect x={4} y={4} width={width * 0.1} height={height - 8} rx={3} fill="rgba(255,255,255,0.06)" />
          {/* cushion lines */}
          <line x1={width * 0.35} y1={height * 0.15} x2={width * 0.35} y2={height * 0.42} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <line x1={width * 0.65} y1={height * 0.15} x2={width * 0.65} y2={height * 0.42} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <line x1={width * 0.13} y1={height * 0.6} x2={width * 0.42} y2={height * 0.6} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          {/* pillows */}
          <ellipse cx={width * 0.2} cy={height * 0.15} rx={width * 0.06} ry={height * 0.06} fill="rgba(255,255,255,0.06)" />
          <ellipse cx={width * 0.12} cy={height * 0.85} rx={width * 0.06} ry={height * 0.06} fill="rgba(255,255,255,0.06)" />
        </svg>
      )
    }
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        {/* arms */}
        <rect x={1} y={height * 0.1} width={width * 0.1} height={height * 0.8} rx={3} fill={c} opacity={0.7} />
        <rect x={width * 0.9} y={height * 0.1} width={width * 0.1} height={height * 0.8} rx={3} fill={c} opacity={0.7} />
        {/* back */}
        <rect x={width * 0.08} y={2} width={width * 0.84} height={height * 0.3} rx={4} fill={c} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        {/* seat */}
        <rect x={width * 0.08} y={height * 0.3} width={width * 0.84} height={height * 0.62} rx={4}
          fill={c} stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
        {/* cushion dividers */}
        {Array.from({ length: Math.max(1, (chairCountOverride ?? element.seats ?? 2) - 1) }).map((_, i) => {
          const seatCount = chairCountOverride ?? element.seats ?? 2
          const x = width * 0.12 + ((width * 0.76) / seatCount) * (i + 1)
          return <line key={i} x1={x} y1={height * 0.35} x2={x} y2={height * 0.85} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        })}
        {/* pillows */}
        <ellipse cx={width * 0.2} cy={height * 0.22} rx={width * 0.06} ry={height * 0.08} fill="rgba(255,255,255,0.05)" />
        <ellipse cx={width * 0.8} cy={height * 0.22} rx={width * 0.06} ry={height * 0.08} fill="rgba(255,255,255,0.05)" />
      </svg>
    )
  }

  if (id === "ottoman") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={3} y={3} width={width - 6} height={height - 6} rx={6} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        {/* tufted pattern */}
        <circle cx={width * 0.35} cy={height * 0.35} r={2} fill="rgba(255,255,255,0.1)" />
        <circle cx={width * 0.65} cy={height * 0.35} r={2} fill="rgba(255,255,255,0.1)" />
        <circle cx={width * 0.35} cy={height * 0.65} r={2} fill="rgba(255,255,255,0.1)" />
        <circle cx={width * 0.65} cy={height * 0.65} r={2} fill="rgba(255,255,255,0.1)" />
      </svg>
    )
  }

  // ── FIXTURES ────────────────────────────────────────

  // ── L-BAR COUNTER (rotated 180: arms at bottom + right, open top-left) ──
  if (id === "bar-corner") {
    const cx = ox
    const cy = oy
    const cw = width * 0.35 // vertical arm thickness (right side)
    const ch = height * 0.35 // horizontal arm thickness (bottom)
    const stoolSize = Math.min(12, Math.min(width, height) * 0.1)
    const stoolGap = stoolSize * 0.2

    // Positions: horizontal arm spans full width at bottom (y from height-ch to height)
    //            vertical arm spans full height on right (x from width-cw to width)
    const armBottom = cy + height - ch
    const armRight = cx + width - cw

    // Split seats between horizontal and vertical edges proportionally
    const seats = chairCountOverride ?? element.seats ?? 8
    const hRatio = width / (width + height)
    const hStoolCount = Math.max(1, Math.round(seats * hRatio))
    const vStoolCount = Math.max(0, seats - hStoolCount)

    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} width={width} height={height} className="block" style={{ filter: glow, overflow: "visible" }}>
        {/* stools along outside bottom of horizontal arm - customers face up toward bar */}
        {Array.from({ length: hStoolCount }).map((_, i) => {
          const sx = cx + 10 + ((width - 20) / hStoolCount) * (i + 0.5)
          const sy = cy + height + stoolGap
          return <Chair key={`h${i}`} x={sx} y={sy} size={stoolSize} facingAngle={0} />
        })}
        {/* stools along outside right of vertical arm - customers face left toward bar */}
        {Array.from({ length: vStoolCount }).map((_, i) => {
          const sx = cx + width + stoolGap
          const sy = cy + 10 + ((height - 20) / vStoolCount) * (i + 0.5)
          return <Chair key={`v${i}`} x={sx} y={sy} size={stoolSize} facingAngle={90} />
        })}
        {/* outer L-shape: bottom arm + right arm */}
        <path d={`
          M ${cx + 3} ${armBottom}
          Q ${cx + 3} ${armBottom - 4} ${cx + 7} ${armBottom - 4}
          L ${armRight - 4} ${armBottom - 4}
          Q ${armRight} ${armBottom - 4} ${armRight} ${armBottom - 8}
          L ${armRight} ${cy + 7}
          Q ${armRight} ${cy + 3} ${armRight + 4} ${cy + 3}
          L ${cx + width - 3} ${cy + 3}
          L ${cx + width - 3} ${cy + height - 3}
          L ${cx + 3} ${cy + height - 3}
          Z
        `} fill={c} stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
        {/* inner edge highlight */}
        <path d={`
          M ${cx + 8} ${armBottom + 2}
          L ${armRight + 2} ${armBottom + 2}
          L ${armRight + 2} ${cy + 8}
          L ${cx + width - 8} ${cy + 8}
          L ${cx + width - 8} ${cy + height - 8}
          L ${cx + 8} ${cy + height - 8}
          Z
        `} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        {/* wood grain lines on horizontal arm (bottom) */}
        {Array.from({ length: 4 }).map((_, i) => {
          const y = armBottom + 8 + ((ch - 14) / 4) * (i + 0.5)
          return <line key={`h${i}`} x1={cx + 10} y1={y} x2={armRight - 10} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
        })}
        {/* wood grain lines on vertical arm (right) */}
        {Array.from({ length: 4 }).map((_, i) => {
          const x = armRight + 8 + ((cw - 14) / 4) * (i + 0.5)
          return <line key={`v${i}`} x1={x} y1={cy + 10} x2={x} y2={armBottom - 10} stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
        })}
        {/* foot rail along inner edge */}
        <line x1={cx + 6} y1={armBottom - 2} x2={armRight - 6} y2={armBottom - 2} stroke="rgba(200,180,120,0.2)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1={armRight - 2} y1={cy + 6} x2={armRight - 2} y2={armBottom - 6} stroke="rgba(200,180,120,0.2)" strokeWidth="1.5" strokeLinecap="round" />
        {/* sink well in corner */}
        <rect x={armRight + cw * 0.25} y={armBottom + ch * 0.25} width={cw * 0.45} height={ch * 0.45} rx={3}
          fill="rgba(100,140,160,0.15)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
        <circle cx={armRight + cw * 0.48} cy={armBottom + ch * 0.48} r={2} fill="rgba(255,255,255,0.12)" />
        {/* glass rack on horizontal arm */}
        <rect x={cx + width * 0.15} y={armBottom + ch * 0.25} width={width * 0.25} height={ch * 0.5} rx={2}
          fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
      </svg>
    )
  }

  // ── L-BAR LEFT (exact mirror of bar-corner: arms at bottom + left, open top-right) ──
  if (id === "bar-corner-left") {
    const cx = ox
    const cy = oy
    const cw = width * 0.35
    const ch = height * 0.35
    const stoolSize = Math.min(12, Math.min(width, height) * 0.1)
    const stoolGap = stoolSize * 0.2

    const armBottom = cy + height - ch
    const armLeft = cx + cw

    const seats = chairCountOverride ?? element.seats ?? 8
    const hRatio = width / (width + height)
    const hStoolCount = Math.max(1, Math.round(seats * hRatio))
    const vStoolCount = Math.max(0, seats - hStoolCount)

    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} width={width} height={height} className="block" style={{ filter: glow, overflow: "visible" }}>
        {/* stools along outside bottom */}
        {Array.from({ length: hStoolCount }).map((_, i) => {
          const sx = cx + 10 + ((width - 20) / hStoolCount) * (i + 0.5)
          const sy = cy + height + stoolGap
          return <Chair key={`h${i}`} x={sx} y={sy} size={stoolSize} facingAngle={0} />
        })}
        {/* stools along outside left */}
        {Array.from({ length: vStoolCount }).map((_, i) => {
          const sx = cx - stoolGap
          const sy = cy + 10 + ((height - 20) / vStoolCount) * (i + 0.5)
          return <Chair key={`v${i}`} x={sx} y={sy} size={stoolSize} facingAngle={270} />
        })}
        {/* outer L-shape: bottom arm + left arm (exact mirror of bar-corner) */}
        <path d={`
          M ${cx + width - 3} ${armBottom}
          Q ${cx + width - 3} ${armBottom - 4} ${cx + width - 7} ${armBottom - 4}
          L ${armLeft + 4} ${armBottom - 4}
          Q ${armLeft} ${armBottom - 4} ${armLeft} ${armBottom - 8}
          L ${armLeft} ${cy + 7}
          Q ${armLeft} ${cy + 3} ${armLeft - 4} ${cy + 3}
          L ${cx + 3} ${cy + 3}
          L ${cx + 3} ${cy + height - 3}
          L ${cx + width - 3} ${cy + height - 3}
          Z
        `} fill={c} stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
        {/* inner edge highlight */}
        <path d={`
          M ${cx + width - 8} ${armBottom + 2}
          L ${armLeft - 2} ${armBottom + 2}
          L ${armLeft - 2} ${cy + 8}
          L ${cx + 8} ${cy + 8}
          L ${cx + 8} ${cy + height - 8}
          L ${cx + width - 8} ${cy + height - 8}
          Z
        `} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        {/* wood grain lines on horizontal arm (bottom) */}
        {Array.from({ length: 4 }).map((_, i) => {
          const y = armBottom + 8 + ((ch - 14) / 4) * (i + 0.5)
          return <line key={`h${i}`} x1={armLeft + 10} y1={y} x2={cx + width - 10} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
        })}
        {/* wood grain lines on vertical arm (left) */}
        {Array.from({ length: 4 }).map((_, i) => {
          const x = cx + 8 + ((cw - 14) / 4) * (i + 0.5)
          return <line key={`v${i}`} x1={x} y1={cy + 10} x2={x} y2={armBottom - 10} stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
        })}
        {/* foot rail along inner edge */}
        <line x1={armLeft + 6} y1={armBottom - 2} x2={cx + width - 6} y2={armBottom - 2} stroke="rgba(200,180,120,0.2)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1={armLeft + 2} y1={cy + 6} x2={armLeft + 2} y2={armBottom - 6} stroke="rgba(200,180,120,0.2)" strokeWidth="1.5" strokeLinecap="round" />
        {/* sink well in corner */}
        <rect x={cx + cw * 0.3} y={armBottom + ch * 0.25} width={cw * 0.45} height={ch * 0.45} rx={3}
          fill="rgba(100,140,160,0.15)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
        <circle cx={cx + cw * 0.52} cy={armBottom + ch * 0.48} r={2} fill="rgba(255,255,255,0.12)" />
        {/* glass rack on horizontal arm */}
        <rect x={cx + width * 0.55} y={armBottom + ch * 0.25} width={width * 0.25} height={ch * 0.5} rx={2}
          fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
      </svg>
    )
  }

  // ── CURVED BAR ────────────────────────────────────
  if (id === "bar-curved") {
    const cx = ox
    const cy = oy
    const stoolSize = Math.min(12, Math.min(width, height) * 0.12)
    const stoolCount = chairCountOverride ?? element.seats ?? 6

    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} width={width} height={height} className="block" style={{ filter: glow, overflow: "visible" }}>
        {/* stools along the curved front edge */}
        {Array.from({ length: stoolCount }).map((_, i) => {
          // Parametric t from 0 to 1 along the inner curve
          const t = (i + 0.5) / stoolCount
          // Quadratic bezier: P = (1-t)^2*P0 + 2*(1-t)*t*P1 + t^2*P2
          // Inner curve control points
          const p0x = cx + width * 0.18, p0y = cy + height - 6
          const p1x = cx + width * 0.5, p1y = cy + height * 0.3
          const p2x = cx + width * 0.82, p2y = cy + height - 6
          const bx = (1 - t) ** 2 * p0x + 2 * (1 - t) * t * p1x + t ** 2 * p2x
          const by = (1 - t) ** 2 * p0y + 2 * (1 - t) * t * p1y + t ** 2 * p2y
          // Tangent for facing direction
          const tx = 2 * (1 - t) * (p1x - p0x) + 2 * t * (p2x - p1x)
          const ty = 2 * (1 - t) * (p1y - p0y) + 2 * t * (p2y - p1y)
          // Normal (outward from curve, pointing away from bar center)
          const nLen = Math.sqrt(tx * tx + ty * ty)
          const nx = ty / nLen
          const ny = -tx / nLen
          // Place stool outside the curve
          const sx = bx + nx * (stoolSize * 0.6 + 2)
          const sy = by + ny * (stoolSize * 0.6 + 2)
          const facing = (Math.atan2(-ny, -nx) * 180) / Math.PI + 90
          return <Chair key={i} x={sx} y={sy} size={stoolSize} facingAngle={facing} />
        })}
        {/* outer curved shape */}
        <path
          d={`M ${cx + width * 0.1} ${cy + height - 4} Q ${cx + width * 0.1} ${cy + 4} ${cx + width * 0.5} ${cy + 4} Q ${cx + width * 0.9} ${cy + 4} ${cx + width * 0.9} ${cy + height - 4} Z`}
          fill={c} stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
        {/* inner curved edge */}
        <path
          d={`M ${cx + width * 0.18} ${cy + height - 6} Q ${cx + width * 0.18} ${cy + height * 0.3} ${cx + width * 0.5} ${cy + height * 0.3} Q ${cx + width * 0.82} ${cy + height * 0.3} ${cx + width * 0.82} ${cy + height - 6}`}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* wood grain curves */}
        {[0.38, 0.5, 0.62].map((frac) => (
          <path key={frac}
            d={`M ${cx + width * 0.2} ${cy + height * frac + height * 0.25} Q ${cx + width * 0.5} ${cy + height * frac * 0.6} ${cx + width * 0.8} ${cy + height * frac + height * 0.25}`}
            fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.8" />
        ))}
        {/* foot rail */}
        <path
          d={`M ${cx + width * 0.16} ${cy + height - 5} Q ${cx + width * 0.16} ${cy + height * 0.28} ${cx + width * 0.5} ${cy + height * 0.28} Q ${cx + width * 0.84} ${cy + height * 0.28} ${cx + width * 0.84} ${cy + height - 5}`}
          fill="none" stroke="rgba(200,180,120,0.2)" strokeWidth="1.5" strokeLinecap="round" />
        {/* sink well */}
        <ellipse cx={cx + width * 0.5} cy={cy + height * 0.55} rx={width * 0.1} ry={height * 0.08}
          fill="rgba(100,140,160,0.15)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
        <circle cx={cx + width * 0.5} cy={cy + height * 0.55} r={1.5} fill="rgba(255,255,255,0.12)" />
        {/* speed rail (bottles) */}
        {Array.from({ length: 5 }).map((_, i) => {
          const t = (i + 1) / 6
          const bx = cx + width * 0.2 + (width * 0.6) * t
          const by = cy + height * 0.14 + Math.sin(t * Math.PI) * (height * -0.02)
          return <rect key={i} x={bx - 2} y={by} width={4} height={8} rx={1.5} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        })}
      </svg>
    )
  }

  // ── STRAIGHT BAR COUNTER ──────────────────────��───
  if (id === "bar-counter") {
    const cx = ox
    const cy = oy
    const stoolSize = Math.min(12, height * 0.22)
    const stoolCount = chairCountOverride ?? element.seats ?? 6
    const stoolGap = stoolSize * 0.2

    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} width={width} height={height} className="block" style={{ filter: glow, overflow: "visible" }}>
        {/* stools along front edge (bottom) */}
        {Array.from({ length: stoolCount }).map((_, i) => {
          const sx = cx + 10 + ((width - 20) / stoolCount) * (i + 0.5)
          const sy = cy + height + stoolGap
          return <Chair key={i} x={sx} y={sy} size={stoolSize} facingAngle={0} />
        })}
        {/* counter surface */}
        <rect x={cx + 3} y={cy + 3} width={width - 6} height={height - 6} rx={4} fill={c} stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
        {/* inner edge */}
        <rect x={cx + 6} y={cy + 6} width={width - 12} height={height - 12} rx={2} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        {/* wood grain lines */}
        {Array.from({ length: 3 }).map((_, i) => {
          const y = cy + 10 + ((height - 20) / 3) * (i + 0.5)
          return <line key={i} x1={cx + 10} y1={y} x2={cx + width - 10} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
        })}
        {/* bar rail / foot rail */}
        <rect x={cx + 5} y={cy + height - 8} width={width - 10} height={2.5} rx={1.25} fill="rgba(200,180,120,0.2)" />
        {/* sink well */}
        <rect x={cx + width * 0.7} y={cy + height * 0.25} width={width * 0.12} height={height * 0.5} rx={3}
          fill="rgba(100,140,160,0.15)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.6" />
        <circle cx={cx + width * 0.76} cy={cy + height * 0.5} r={1.5} fill="rgba(255,255,255,0.12)" />
        {/* speed rail (bottles) */}
        {Array.from({ length: Math.max(3, Math.floor(width / 40)) }).map((_, i) => {
          const x = cx + 12 + ((width * 0.55) / Math.max(3, Math.floor(width / 40))) * (i + 0.5)
          return <rect key={i} x={x - 2} y={cy + 8} width={4} height={height * 0.3} rx={1.5} fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        })}
      </svg>
    )
  }

  if (id === "host-stand" || id === "cash-register") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={3} y={3} width={width - 6} height={height - 6} rx={3} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        {/* screen */}
        <rect x={width * 0.2} y={5} width={width * 0.6} height={height * 0.45} rx={2} fill="hsl(185, 70%, 30%)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        <rect x={width * 0.25} y={7} width={width * 0.5} height={height * 0.3} rx={1} fill="hsl(185, 85%, 45%)" opacity={0.2} />
        {/* base */}
        <rect x={width * 0.3} y={height * 0.6} width={width * 0.4} height={height * 0.3} rx={2} fill="rgba(255,255,255,0.06)" />
      </svg>
    )
  }

  if (id === "kitchen-window") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={2} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <rect x={6} y={height * 0.2} width={width - 12} height={height * 0.6} rx={1} fill="hsl(0, 50%, 25%)" opacity={0.5} />
        {[0.25, 0.5, 0.75].map((p) => (
          <circle key={p} cx={width * p} cy={height * 0.5} r={3} fill="hsl(38, 90%, 55%)" opacity={0.6} />
        ))}
      </svg>
    )
  }

  if (id === "kitchen-area") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={4} fill={c} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <rect x={6} y={6} width={width - 12} height={height * 0.15} rx={2} fill="rgba(255,255,255,0.08)" />
        <rect x={6} y={height - 6 - height * 0.15} width={width - 12} height={height * 0.15} rx={2} fill="rgba(255,255,255,0.08)" />
        <rect x={width * 0.25} y={height * 0.35} width={width * 0.5} height={height * 0.3} rx={3} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <text x={width / 2} y={height / 2 + 3} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={Math.min(11, width * 0.06)} fontFamily="sans-serif">KITCHEN</text>
      </svg>
    )
  }

  if (id === "service-station") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={3} y={3} width={width - 6} height={height - 6} rx={3} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <rect x={width * 0.1} y={6} width={width * 0.35} height={height * 0.4} rx={2} fill="rgba(255,255,255,0.08)" />
        <rect x={width * 0.55} y={8} width={width * 0.35} height={height * 0.35} rx={2} fill="rgba(255,255,255,0.06)" />
        <rect x={width * 0.1} y={height * 0.55} width={width * 0.8} height={height * 0.35} rx={2} fill="rgba(255,255,255,0.05)" />
      </svg>
    )
  }

  if (id === "restroom") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={4} fill={c} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <rect x={width * 0.35} y={height - 4} width={width * 0.3} height={4} fill="hsl(30, 35%, 30%)" />
        <circle cx={width / 2} cy={height * 0.3} r={width * 0.08} fill="rgba(255,255,255,0.2)" />
        <path d={`M ${width * 0.38} ${height * 0.42} L ${width * 0.38} ${height * 0.7} M ${width * 0.62} ${height * 0.42} L ${width * 0.62} ${height * 0.7}`}
          stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" />
        <text x={width / 2} y={height * 0.85} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize={Math.min(10, width * 0.12)} fontFamily="sans-serif">WC</text>
      </svg>
    )
  }

  if (id === "sink") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={3} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <ellipse cx={width / 2} cy={height / 2} rx={width * 0.32} ry={height * 0.32} fill="hsl(200, 30%, 22%)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <rect x={width / 2 - 2} y={3} width={4} height={height * 0.3} rx={2} fill="rgba(255,255,255,0.15)" />
        <circle cx={width / 2} cy={height * 0.3 + 3} r={2} fill="rgba(255,255,255,0.2)" />
      </svg>
    )
  }

  if (id === "refrigerator") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={3} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <line x1={4} y1={height * 0.38} x2={width - 4} y2={height * 0.38} stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
        <rect x={width - 8} y={height * 0.15} width={2} height={height * 0.15} rx={1} fill="rgba(255,255,255,0.2)" />
        <rect x={width - 8} y={height * 0.5} width={2} height={height * 0.2} rx={1} fill="rgba(255,255,255,0.2)" />
      </svg>
    )
  }

  if (id === "oven") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={3} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        {[[0.3, 0.3], [0.7, 0.3], [0.3, 0.65], [0.7, 0.65]].map(([px, py], i) => (
          <g key={i}>
            <circle cx={width * px} cy={height * py} r={Math.min(width, height) * 0.12} fill="none" stroke="hsl(0, 50%, 40%)" strokeWidth="1.5" opacity={0.6} />
            <circle cx={width * px} cy={height * py} r={Math.min(width, height) * 0.05} fill="hsl(0, 60%, 45%)" opacity={0.4} />
          </g>
        ))}
      </svg>
    )
  }

  if (id === "dishwasher") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={3} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <rect x={4} y={4} width={width - 8} height={height * 0.15} rx={1} fill="rgba(255,255,255,0.08)" />
        <rect x={width * 0.25} y={height * 0.22} width={width * 0.5} height={2} rx={1} fill="rgba(255,255,255,0.15)" />
        <rect x={4} y={height * 0.28} width={width - 8} height={height * 0.66} rx={2} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      </svg>
    )
  }

  if (id === "wine-rack") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={2} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        {Array.from({ length: Math.max(3, Math.floor(width / 14)) }).map((_, i) => {
          const x = 6 + ((width - 12) / Math.max(3, Math.floor(width / 14))) * (i + 0.5)
          return <ellipse key={i} cx={x} cy={height / 2} rx={3} ry={height * 0.3} fill="hsl(350, 50%, 25%)" opacity={0.6} />
        })}
      </svg>
    )
  }

  if (id === "buffet-station" || id === "salad-bar") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={4} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        {Array.from({ length: Math.max(2, Math.floor(width / 45)) }).map((_, i) => {
          const wells = Math.max(2, Math.floor(width / 45))
          const w = (width - 12) / wells - 4
          const x = 8 + ((width - 12) / wells) * i
          return <rect key={i} x={x} y={8} width={w} height={height - 16} rx={3} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        })}
        <line x1={4} y1={3} x2={width - 4} y2={3} stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
      </svg>
    )
  }

  if (id === "display-case") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={3} fill={c} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        <rect x={4} y={4} width={width - 8} height={height * 0.4} rx={2} fill="hsl(200, 20%, 40%)" opacity={0.2} />
        <line x1={4} y1={height * 0.5} x2={width - 4} y2={height * 0.5} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <line x1={4} y1={height * 0.75} x2={width - 4} y2={height * 0.75} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      </svg>
    )
  }

  if (id === "stage") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={4} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <rect x={6} y={6} width={width - 12} height={height - 12} rx={2} fill="rgba(255,255,255,0.04)" />
        <rect x={3} y={3} width={width * 0.08} height={height - 6} rx={2} fill="rgba(255,255,255,0.06)" />
        <rect x={width - 3 - width * 0.08} y={3} width={width * 0.08} height={height - 6} rx={2} fill="rgba(255,255,255,0.06)" />
        <ellipse cx={width / 2} cy={height * 0.4} rx={width * 0.15} ry={height * 0.12} fill="rgba(255,255,255,0.06)" />
        <text x={width / 2} y={height * 0.65} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={Math.min(12, width * 0.06)} fontFamily="sans-serif">STAGE</text>
      </svg>
    )
  }

  if (id === "dj-booth") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={4} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <circle cx={width * 0.3} cy={height * 0.45} r={Math.min(width * 0.18, height * 0.25)} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <circle cx={width * 0.7} cy={height * 0.45} r={Math.min(width * 0.18, height * 0.25)} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <circle cx={width * 0.3} cy={height * 0.45} r={2} fill="rgba(255,255,255,0.2)" />
        <circle cx={width * 0.7} cy={height * 0.45} r={2} fill="rgba(255,255,255,0.2)" />
        <rect x={width * 0.42} y={height * 0.2} width={width * 0.16} height={height * 0.5} rx={2} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      </svg>
    )
  }

  if (id === "coat-check") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={3} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <line x1={8} y1={height * 0.35} x2={width - 8} y2={height * 0.35} stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
        {[0.25, 0.4, 0.55, 0.7].map((p) => (
          <path key={p} d={`M ${width * p} ${height * 0.35} L ${width * p - 3} ${height * 0.55} L ${width * p + 3} ${height * 0.55}`}
            fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        ))}
      </svg>
    )
  }

  if (id === "elevator") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={3} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <rect x={width * 0.15} y={height * 0.15} width={width * 0.33} height={height * 0.7} rx={1} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <rect x={width * 0.52} y={height * 0.15} width={width * 0.33} height={height * 0.7} rx={1} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <path d={`M ${width / 2} ${height * 0.05} L ${width / 2 + 4} ${height * 0.12} L ${width / 2 - 4} ${height * 0.12} Z`} fill="rgba(255,255,255,0.15)" />
        <path d={`M ${width / 2} ${height * 0.95} L ${width / 2 + 4} ${height * 0.88} L ${width / 2 - 4} ${height * 0.88} Z`} fill="rgba(255,255,255,0.15)" />
      </svg>
    )
  }

  // ── WALLS ───────────────────────────────────────────
  if (id.startsWith("wall-")) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block">
        <rect x={0} y={0} width={width} height={height} fill={c} />
        {width > height
          ? Array.from({ length: Math.floor(width / 20) }).map((_, i) => (
              <line key={i} x1={20 + i * 20} y1={0} x2={20 + i * 20} y2={height} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            ))
          : Array.from({ length: Math.floor(height / 20) }).map((_, i) => (
              <line key={i} x1={0} y1={20 + i * 20} x2={width} y2={20 + i * 20} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            ))
        }
      </svg>
    )
  }

  if (id === "partition" || id === "half-wall" || id === "railing") {
    const dashed = id === "railing"
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block">
        <rect x={0} y={0} width={width} height={height} rx={2} fill={c} stroke="rgba(255,255,255,0.15)" strokeWidth="1"
          strokeDasharray={dashed ? "6 3" : "none"} />
      </svg>
    )
  }

  if (id === "glass-partition" || id === "window-wall") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={0} y={0} width={width} height={height} rx={1} fill={c} opacity={0.3} stroke={c} strokeWidth="1.5" />
        {Array.from({ length: Math.max(2, Math.floor(width / 30)) }).map((_, i) => {
          const x = (width / Math.max(2, Math.floor(width / 30))) * (i + 1)
          return <line key={i} x1={x} y1={0} x2={x} y2={height} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        })}
        <rect x={2} y={1} width={width * 0.4} height={height - 2} rx={1} fill="rgba(255,255,255,0.05)" />
      </svg>
    )
  }

  if (id === "column" || id === "column-square") {
    const isRound = id === "column"
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        {isRound
          ? <circle cx={width / 2} cy={height / 2} r={width / 2 - 1} fill={c} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
          : <rect x={1} y={1} width={width - 2} height={height - 2} fill={c} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        }
        {isRound
          ? <ellipse cx={width * 0.4} cy={height * 0.4} rx={width * 0.12} ry={height * 0.18} fill="rgba(255,255,255,0.1)" />
          : <rect x={2} y={2} width={width * 0.3} height={height - 4} fill="rgba(255,255,255,0.06)" />
        }
      </svg>
    )
  }

  if (id === "curtain") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <path d={`M 0 ${height / 2} ${Array.from({ length: Math.floor(width / 10) }).map((_, i) => `Q ${i * 10 + 5} ${i % 2 === 0 ? 0 : height} ${(i + 1) * 10} ${height / 2}`).join(" ")}`}
          fill="none" stroke={c} strokeWidth={height * 0.8} opacity={0.7} />
      </svg>
    )
  }

  if (id === "doorway" || id === "arch") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={0} y={0} width={width * 0.15} height={height} fill={c} />
        <rect x={width * 0.85} y={0} width={width * 0.15} height={height} fill={c} />
        {id === "arch" && (
          <path d={`M ${width * 0.15} ${height} Q ${width / 2} ${-height * 0.5} ${width * 0.85} ${height}`}
            fill="none" stroke={c} strokeWidth="2" opacity={0.5} />
        )}
        <path d={`M ${width * 0.15} ${height} A ${width * 0.6} ${width * 0.6} 0 0 1 ${width * 0.75} ${height * 0.3}`}
          fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3 3" />
      </svg>
    )
  }

  if (id === "stairs") {
    const steps = Math.max(5, Math.floor(height / 16))
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={1} y={1} width={width - 2} height={height - 2} rx={2} fill={c} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        {Array.from({ length: steps }).map((_, i) => (
          <line key={i} x1={4} y1={4 + ((height - 8) / steps) * (i + 1)} x2={width - 4} y2={4 + ((height - 8) / steps) * (i + 1)}
            stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        ))}
        <path d={`M ${width / 2} ${height * 0.85} L ${width / 2} ${height * 0.15} M ${width / 2 - 5} ${height * 0.22} L ${width / 2} ${height * 0.15} L ${width / 2 + 5} ${height * 0.22}`}
          fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      </svg>
    )
  }

  // ── DECOR ───────────────────────────────────────────
  if (id === "plant-large" || id === "tree-indoor") {
    const r = Math.min(width, height) / 2
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        {/* pot */}
        <path d={`M ${width * 0.3} ${height * 0.7} L ${width * 0.35} ${height - 3} L ${width * 0.65} ${height - 3} L ${width * 0.7} ${height * 0.7} Z`}
          fill="hsl(25, 50%, 28%)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        {/* foliage */}
        <circle cx={width / 2} cy={height * 0.4} r={r * 0.45} fill={c} opacity={0.9} />
        <circle cx={width * 0.35} cy={height * 0.45} r={r * 0.35} fill={c} opacity={0.7} />
        <circle cx={width * 0.65} cy={height * 0.45} r={r * 0.35} fill={c} opacity={0.7} />
        <circle cx={width * 0.42} cy={height * 0.3} r={r * 0.3} fill={c} opacity={0.6} />
        <circle cx={width * 0.58} cy={height * 0.3} r={r * 0.3} fill={c} opacity={0.6} />
        <circle cx={width / 2} cy={height * 0.25} r={r * 0.2} fill="hsl(140, 55%, 42%)" opacity={0.5} />
      </svg>
    )
  }

  if (id === "plant-small") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <path d={`M ${width * 0.28} ${height * 0.6} L ${width * 0.33} ${height - 2} L ${width * 0.67} ${height - 2} L ${width * 0.72} ${height * 0.6} Z`}
          fill="hsl(25, 50%, 28%)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <ellipse cx={width / 2} cy={height * 0.4} rx={width * 0.3} ry={height * 0.25} fill={c} opacity={0.85} />
        <ellipse cx={width * 0.38} cy={height * 0.35} rx={width * 0.15} ry={height * 0.2} fill={c} opacity={0.7} transform={`rotate(-15 ${width * 0.38} ${height * 0.35})`} />
        <ellipse cx={width * 0.62} cy={height * 0.35} rx={width * 0.15} ry={height * 0.2} fill={c} opacity={0.7} transform={`rotate(15 ${width * 0.62} ${height * 0.35})`} />
      </svg>
    )
  }

  if (id === "planter-box") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={height * 0.4} width={width - 4} height={height * 0.55} rx={2} fill="hsl(25, 45%, 25%)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
        {Array.from({ length: Math.max(3, Math.floor(width / 25)) }).map((_, i) => {
          const cx = 8 + ((width - 16) / Math.max(3, Math.floor(width / 25))) * (i + 0.5)
          return <circle key={i} cx={cx} cy={height * 0.35} r={Math.min(8, height * 0.25)} fill={c} opacity={0.8 - i * 0.05} />
        })}
      </svg>
    )
  }

  if (id === "rug" || id === "rug-runner") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block">
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={3} fill={c} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <rect x={6} y={6} width={width - 12} height={height - 12} rx={2} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
        <rect x={10} y={10} width={width - 20} height={height - 20} rx={1} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        <ellipse cx={width / 2} cy={height / 2} rx={Math.min(width * 0.15, 20)} ry={Math.min(height * 0.2, 15)} fill="rgba(255,255,255,0.05)" />
      </svg>
    )
  }

  if (id === "rug-round") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block">
        <circle cx={width / 2} cy={height / 2} r={width / 2 - 3} fill={c} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <circle cx={width / 2} cy={height / 2} r={width / 2 - 8} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
        <circle cx={width / 2} cy={height / 2} r={width / 2 - 14} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        <circle cx={width / 2} cy={height / 2} r={width * 0.12} fill="rgba(255,255,255,0.05)" />
      </svg>
    )
  }

  if (id === "fireplace") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={3} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <rect x={width * 0.15} y={4} width={width * 0.7} height={height - 8} rx={2} fill="hsl(15, 60%, 20%)" />
        <ellipse cx={width * 0.4} cy={height * 0.5} rx={6} ry={height * 0.3} fill="hsl(38, 90%, 55%)" opacity={0.5} />
        <ellipse cx={width * 0.55} cy={height * 0.5} rx={5} ry={height * 0.35} fill="hsl(15, 80%, 50%)" opacity={0.4} />
        <ellipse cx={width * 0.48} cy={height * 0.45} rx={4} ry={height * 0.2} fill="hsl(45, 100%, 65%)" opacity={0.3} />
      </svg>
    )
  }

  if (id === "fountain") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <circle cx={width / 2} cy={height / 2} r={width / 2 - 3} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <circle cx={width / 2} cy={height / 2} r={width / 2 - 8} fill="hsl(200, 60%, 30%)" opacity={0.5} />
        <circle cx={width / 2} cy={height / 2} r={width * 0.2} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
        <circle cx={width / 2} cy={height / 2} r={width * 0.3} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
        <circle cx={width / 2} cy={height / 2} r={4} fill="rgba(255,255,255,0.15)" />
        <circle cx={width / 2} cy={height / 2} r={2} fill="rgba(255,255,255,0.25)" />
      </svg>
    )
  }

  if (id === "statue") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <circle cx={width / 2} cy={height / 2} r={width / 2 - 2} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <polygon points={`${width / 2},${height * 0.15} ${width * 0.75},${height * 0.45} ${width * 0.65},${height * 0.8} ${width * 0.35},${height * 0.8} ${width * 0.25},${height * 0.45}`}
          fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        <line x1={width / 2} y1={height * 0.15} x2={width * 0.35} y2={height * 0.8} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1={width / 2} y1={height * 0.15} x2={width * 0.65} y2={height * 0.8} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      </svg>
    )
  }

  if (id === "lamp-floor" || id === "chandelier") {
    const big = id === "chandelier"
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <circle cx={width / 2} cy={height / 2} r={width / 2 - 1} fill={c} opacity={0.15} />
        <circle cx={width / 2} cy={height / 2} r={width / 2 - 4} fill={c} opacity={0.1} />
        <circle cx={width / 2} cy={height / 2} r={big ? width * 0.2 : width * 0.25} fill={c} opacity={0.8} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        <circle cx={width / 2} cy={height / 2} r={big ? width * 0.08 : width * 0.1} fill="rgba(255,255,255,0.4)" />
        {big && (
          <>
            {[0, 60, 120, 180, 240, 300].map((angle) => {
              const rad = (angle * Math.PI) / 180
              const x1 = width / 2 + Math.cos(rad) * width * 0.2
              const y1 = height / 2 + Math.sin(rad) * height * 0.2
              const x2 = width / 2 + Math.cos(rad) * width * 0.38
              const y2 = height / 2 + Math.sin(rad) * height * 0.38
              return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
            })}
          </>
        )}
      </svg>
    )
  }

  if (id === "mirror") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={1} y={1} width={width - 2} height={height - 2} rx={2} fill={c} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
        <rect x={width * 0.1} y={1} width={width * 0.25} height={height - 2} fill="rgba(255,255,255,0.1)" rx={1} />
      </svg>
    )
  }

  if (id === "bookshelf") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={2} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        {Array.from({ length: Math.max(5, Math.floor(width / 10)) }).map((_, i) => {
          const x = 4 + ((width - 8) / Math.max(5, Math.floor(width / 10))) * i
          const w = Math.max(3, (width - 8) / Math.max(5, Math.floor(width / 10)) - 1)
          const h = height - 8 - (i * 7 % 5) * 1.2
          const hue = [25, 200, 350, 140, 40, 270][i % 6]
          return <rect key={i} x={x} y={4 + (height - 8 - h)} width={w} height={h} rx={0.5} fill={`hsl(${hue}, 30%, 30%)`} opacity={0.6} />
        })}
      </svg>
    )
  }

  if (id === "aquarium") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={4} fill={c} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        <rect x={4} y={4} width={width - 8} height={height - 8} rx={2} fill="hsl(200, 70%, 30%)" opacity={0.3} />
        <circle cx={width * 0.7} cy={height * 0.3} r={2} fill="rgba(255,255,255,0.15)" />
        <circle cx={width * 0.75} cy={height * 0.5} r={1.5} fill="rgba(255,255,255,0.1)" />
        <circle cx={width * 0.65} cy={height * 0.6} r={1} fill="rgba(255,255,255,0.1)" />
        <ellipse cx={width * 0.3} cy={height * 0.4} rx={8} ry={4} fill="hsl(38, 80%, 55%)" opacity={0.4} />
        <ellipse cx={width * 0.55} cy={height * 0.6} rx={6} ry={3} fill="hsl(0, 60%, 50%)" opacity={0.3} />
      </svg>
    )
  }

  if (id === "candles") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <circle cx={width / 2} cy={height / 2} r={width / 2 - 1} fill={c} opacity={0.15} />
        <rect x={width * 0.35} y={height * 0.4} width={width * 0.3} height={height * 0.5} rx={2} fill="hsl(38, 40%, 80%)" opacity={0.7} />
        <ellipse cx={width / 2} cy={height * 0.3} rx={3} ry={5} fill="hsl(38, 90%, 60%)" opacity={0.7} />
        <ellipse cx={width / 2} cy={height * 0.28} rx={1.5} ry={3} fill="hsl(45, 100%, 75%)" opacity={0.5} />
      </svg>
    )
  }

  if (id === "umbrella") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <circle cx={width / 2} cy={height / 2} r={width / 2 - 3} fill={c} opacity={0.3} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <circle cx={width / 2} cy={height / 2} r={width / 2 - 6} fill={c} opacity={0.6} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
          const rad = (angle * Math.PI) / 180
          return <line key={angle} x1={width / 2} y1={height / 2} x2={width / 2 + Math.cos(rad) * (width / 2 - 8)} y2={height / 2 + Math.sin(rad) * (height / 2 - 8)}
            stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
        })}
        <circle cx={width / 2} cy={height / 2} r={3} fill="rgba(255,255,255,0.2)" />
      </svg>
    )
  }

  if (id === "tv-screen") {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
        <rect x={1} y={1} width={width - 2} height={height - 2} rx={1} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x={3} y={2} width={width - 6} height={height - 4} rx={0.5} fill="hsl(185, 70%, 20%)" opacity={0.3} />
        <rect x={width * 0.05} y={2} width={width * 0.15} height={height - 4} fill="rgba(255,255,255,0.03)" />
      </svg>
    )
  }

  // ── FALLBACK ────────────────────────────────────────
  const isCircle = element.shape === "circle" || element.shape === "ellipse"
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" style={{ filter: glow }}>
      {isCircle ? (
        <ellipse cx={width / 2} cy={height / 2} rx={width / 2 - 2} ry={height / 2 - 2} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      ) : (
        <rect x={2} y={2} width={width - 4} height={height - 4} rx={4} fill={c} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      )}
    </svg>
  )
}
