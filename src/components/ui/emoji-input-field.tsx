"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import EmojiPicker, { type EmojiClickData, Theme } from "emoji-picker-react"

export interface EmojiPickerButtonProps {
  value: string
  onChange: (emoji: string) => void
  /** Use inside drawers/sheets where Radix portals can conflict */
  forcePortal?: boolean
}

/**
 * A standalone emoji-picker button.
 * Unlike EmojiInputField this does NOT render a bundled text input -
 * use it alongside your own <Input> when emoji and name are separate fields.
 */
export function EmojiPickerButton({ value, onChange, forcePortal = false }: EmojiPickerButtonProps) {
  const [open, setOpen] = React.useState(false)
  const display = value || "😀"

  const handlePick = (data: EmojiClickData) => {
    onChange(data.emoji)
    setOpen(false)
  }

  if (forcePortal) {
    return (
      <div className="relative shrink-0">
        <button
          type="button"
          aria-label="Pick emoji"
          className="h-9 w-9 rounded-md border border-input bg-background flex items-center justify-center text-lg transition-colors hover:bg-accent cursor-pointer"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o) }}
        >
          {display}
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
            <div
              className="absolute top-full left-0 mt-1 z-[9999] rounded-lg shadow-lg border overflow-hidden bg-white"
              style={{ width: 320, height: 400 }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <EmojiPicker
                onEmojiClick={handlePick}
                theme={Theme.AUTO}
                width={320}
                height={400}
                searchPlaceHolder="Search emojis…"
                previewConfig={{ showPreview: false }}
              />
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Pick emoji"
          className="h-9 w-9 shrink-0 rounded-md border border-input bg-background flex items-center justify-center text-lg transition-colors hover:bg-accent cursor-pointer"
        >
          {display}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-0 z-[9999]"
        align="start"
        side="bottom"
        sideOffset={6}
        style={{ zIndex: 9999 }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <EmojiPicker
          onEmojiClick={handlePick}
          theme={Theme.AUTO}
          width={320}
          height={400}
          searchPlaceHolder="Search emojis…"
          previewConfig={{ showPreview: false }}
        />
      </PopoverContent>
    </Popover>
  )
}

export interface EmojiInputFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  forcePortal?: boolean
}

export function EmojiInputField({ value, onChange, placeholder = "Or type emoji here...", forcePortal = false }: EmojiInputFieldProps) {
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const displayValue = value.slice(0, 2)
  const isEmoji = /\p{Emoji}/u.test(value)

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onChange(emojiData.emoji)
    setOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value

    // Check if input contains an emoji
    const hasEmoji = /\p{Emoji}/u.test(newValue)

    if (hasEmoji) {
      const emojiMatch = newValue.match(/\p{Emoji}/u)
      onChange(emojiMatch ? emojiMatch[0] : newValue)
    } else {
      // Limit to 2 characters and convert to uppercase for initials
      onChange(newValue.slice(0, 2).toUpperCase())
    }
  }

  // For drawers, use a custom implementation to avoid overlay conflicts
  if (forcePortal) {
    return (
      <div className="flex items-center gap-3 w-full">
        <div className="relative">
          <button
            type="button"
            className="shrink-0 h-12 w-12 rounded-xl bg-white border-2 border-gray-200 flex items-center justify-center text-2xl font-bold transition-colors hover:bg-accent hover:border-accent cursor-pointer"
            aria-label="Select emoji or initials"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen(!open)
            }}
          >
            {displayValue || "😊"}
          </button>
          
          {open && (
            <>
              {/* Backdrop to prevent clicks outside */}
              <div 
                className="fixed inset-0 z-[9998]"
                onClick={() => setOpen(false)}
              />
              
              {/* Emoji picker positioned absolutely */}
              <div 
                className="absolute top-full left-0 mt-2 z-[9999] bg-white rounded-lg shadow-lg border overflow-hidden"
                style={{ 
                  width: '320px',
                  height: '400px',
                  maxHeight: '400px'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                }}
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme={Theme.AUTO}
                  width={320}
                  height={400}
                  searchPlaceHolder="Search emojis..."
                  previewConfig={{ showPreview: false }}
                />
              </div>
            </>
          )}
        </div>

        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="flex-1 h-12 text-base"
        />
      </div>
    )
  }

  // Original implementation for non-drawer contexts
  return (
    <div className="flex items-center gap-3 w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="shrink-0 h-12 w-12 rounded-xl bg-white border-2 border-gray-200 flex items-center justify-center text-2xl font-bold transition-colors hover:bg-accent hover:border-accent cursor-pointer"
            aria-label="Select emoji or initials"
          >
            {displayValue || "😊"}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-full p-0 border-0 z-[9999]"
          align="start"
          side="bottom"
          sideOffset={8}
          alignOffset={0}
          avoidCollisions={false}
          collisionPadding={16}
          style={{ zIndex: 9999 }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div style={{ zIndex: 9999, position: 'relative' }} className="emoji-picker-wrapper">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={Theme.AUTO}
              width="100%"
              height={400}
              searchPlaceHolder="Search emojis..."
              previewConfig={{ showPreview: false }}
              style={{ zIndex: 9999 }}
            />
          </div>
        </PopoverContent>
      </Popover>

      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="flex-1 h-12 text-base"
      />
    </div>
  )
}
