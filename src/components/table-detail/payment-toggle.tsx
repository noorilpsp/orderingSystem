"use client"

/**
 * Simple toggle for Payment modal - matches table-merge exactly.
 * Uses inline styles to avoid theme/variable conflicts in portaled content.
 */
export function PaymentToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      style={{
        display: "inline-flex",
        height: "1.5rem",
        width: "2.75rem",
        flexShrink: 0,
        cursor: "pointer",
        alignItems: "center",
        borderRadius: "9999px",
        border: "2px solid transparent",
        padding: 0,
        backgroundColor: checked ? "hsl(185 85% 45%)" : "hsl(220 15% 14%)",
        transition: "background-color 0.2s",
      }}
    >
      <span
        style={{
          display: "block",
          width: "1.25rem",
          height: "1.25rem",
          borderRadius: "9999px",
          backgroundColor: "hsl(210 20% 95%)",
          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.2), 0 4px 6px -4px rgb(0 0 0 / 0.15)",
          transform: checked ? "translateX(1.25rem)" : "translateX(0)",
          transition: "transform 0.2s ease",
        }}
      />
    </button>
  )
}
