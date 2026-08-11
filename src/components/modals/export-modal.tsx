"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { FileSpreadsheet, FileText, FileJson, File, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { ExportFormat, ExportOptions, PDFTemplate } from "@/types/import-export"

interface ExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentFilterSummary?: string
}

export function ExportModal({ open, onOpenChange, currentFilterSummary }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>("xlsx")
  const [options, setOptions] = useState<ExportOptions>({
    format: "xlsx",
    includeItems: true,
    includeCategories: true,
    includeCustomizations: true,
    includePricing: true,
    includePhotos: false,
    includeAnalytics: false,
    applyCurrentFilters: false,
    menus: [],
    statuses: [],
    pdfOptions: {
      template: "classic",
      includePhotos: true,
      includePrices: true,
      includeDescriptions: true,
      includeQRCode: false,
      paperSize: "letter",
    },
  })
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  const formatIcons = {
    xlsx: FileSpreadsheet,
    csv: FileText,
    pdf: File,
    json: FileJson,
  }

  const formatDescriptions = {
    xlsx: "Best for editing in spreadsheets",
    csv: "Simple comma-separated values",
    pdf: "Print-ready menu for display",
    json: "For developers and integrations",
  }

  const Icon = formatIcons[format]

  const handleExport = async () => {
    setIsExporting(true)
    setExportProgress(0)

    // Simulate export progress
    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 10
      })
    }, 200)

    // Simulate export delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    clearInterval(interval)
    setExportProgress(100)

    toast.success("Menu exported successfully", {
      description: `Your ${format.toUpperCase()} file is ready to download.`,
    })

    setIsExporting(false)
    setExportProgress(0)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Export Menu Data</DialogTitle>
          <DialogDescription>Choose your export format and customize what to include</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Format Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Export Format</Label>
              <RadioGroup value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
                {(["xlsx", "csv", "pdf", "json"] as ExportFormat[]).map((fmt) => {
                  const FormatIcon = formatIcons[fmt]
                  return (
                    <div
                      key={fmt}
                      className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                    >
                      <RadioGroupItem value={fmt} id={fmt} />
                      <Label htmlFor={fmt} className="flex items-center gap-3 flex-1 cursor-pointer">
                        <FormatIcon className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">{fmt.toUpperCase()}</div>
                          <div className="text-sm text-muted-foreground">{formatDescriptions[fmt]}</div>
                        </div>
                      </Label>
                    </div>
                  )
                })}
              </RadioGroup>
            </div>

            <Separator />

            {/* What to Include */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">What to Include</Label>
              <div className="space-y-3">
                {[
                  { key: "includeItems", label: "Items", description: "Name, price, description, status" },
                  { key: "includeCategories", label: "Categories", description: "Organization structure" },
                  { key: "includeCustomizations", label: "Customizations", description: "Groups and options" },
                  { key: "includePricing", label: "Pricing", description: "All price variations" },
                  { key: "includePhotos", label: "Photos", description: "URLs only - images not embedded" },
                  { key: "includeAnalytics", label: "Analytics Data", description: "Order history, popularity" },
                ].map(({ key, label, description }) => (
                  <div key={key} className="flex items-start space-x-3">
                    <Checkbox
                      id={key}
                      checked={options[key as keyof ExportOptions] as boolean}
                      onCheckedChange={(checked) => setOptions({ ...options, [key]: checked })}
                    />
                    <div className="grid gap-1 leading-none">
                      <Label htmlFor={key} className="font-medium cursor-pointer">
                        {label}
                      </Label>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Filter Export */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Filter Export</Label>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="apply-filters" className="font-medium cursor-pointer">
                    Only export filtered items
                  </Label>
                  {currentFilterSummary && options.applyCurrentFilters && (
                    <p className="text-sm text-muted-foreground">{currentFilterSummary}</p>
                  )}
                </div>
                <Switch
                  id="apply-filters"
                  checked={options.applyCurrentFilters}
                  onCheckedChange={(checked) => setOptions({ ...options, applyCurrentFilters: checked })}
                />
              </div>
            </div>

            {/* PDF Options */}
            {format === "pdf" && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">PDF Options</Label>

                  <div className="space-y-2">
                    <Label htmlFor="template" className="text-sm">
                      Template
                    </Label>
                    <Select
                      value={options.pdfOptions?.template}
                      onValueChange={(value) =>
                        setOptions({
                          ...options,
                          pdfOptions: { ...options.pdfOptions!, template: value as PDFTemplate },
                        })
                      }
                    >
                      <SelectTrigger id="template">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="classic">Classic Menu</SelectItem>
                        <SelectItem value="modern">Modern Grid</SelectItem>
                        <SelectItem value="minimalist">Minimalist List</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm">Include</Label>
                    {[
                      { key: "includePhotos", label: "Item photos" },
                      { key: "includePrices", label: "Prices" },
                      { key: "includeDescriptions", label: "Descriptions" },
                      { key: "includeQRCode", label: "QR code (links to /menu/{storeSlug}?table={number})" },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Checkbox
                          id={`pdf-${key}`}
                          checked={options.pdfOptions?.[key as keyof typeof options.pdfOptions] as boolean}
                          onCheckedChange={(checked) =>
                            setOptions({
                              ...options,
                              pdfOptions: { ...options.pdfOptions!, [key]: checked },
                            })
                          }
                        />
                        <Label htmlFor={`pdf-${key}`} className="cursor-pointer">
                          {label}
                        </Label>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paper-size" className="text-sm">
                      Paper Size
                    </Label>
                    <Select
                      value={options.pdfOptions?.paperSize}
                      onValueChange={(value) =>
                        setOptions({
                          ...options,
                          pdfOptions: { ...options.pdfOptions!, paperSize: value as "letter" | "a4" },
                        })
                      }
                    >
                      <SelectTrigger id="paper-size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="letter">US Letter</SelectItem>
                        <SelectItem value="a4">A4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {isExporting && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Exporting...</span>
              <span className="font-medium">{exportProgress}%</span>
            </div>
            <Progress value={exportProgress} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export as {format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
