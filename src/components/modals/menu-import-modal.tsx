"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Papa from "papaparse"
import { AlertCircle, CheckCircle2, Download, FileUp, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { downloadMenuImportTemplate, formatMenuCatalogHint, formatStationCatalogHint } from "@/lib/menu/import-template"
import {
  buildImportPlan,
  type ImportMenuCatalog,
  type ImportOptions,
  type ImportRow,
  type ImportStationCatalog,
  type RowValidation,
} from "@/lib/menu/import-items"
import type { Menu } from "@/types/menu"
import type { Category } from "@/types/category"
import { isStationSettingsView } from "@/lib/kds/stationSettingsView"
import { useMerchantKdsEnabled } from "@/lib/hooks/useMerchantKdsEnabled"

type Step = "upload" | "preview" | "result"

interface MenuImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locationId: string | null
  categories: Category[]
  menus: Menu[]
  onImport: (
    rows: ImportRow[],
    options: ImportOptions,
  ) => Promise<{
    created: number
    skipped: number
    categoriesCreated: string[]
    errors: Array<{ row: number; field?: string; message: string }>
  }>
}

function getRowStatus(validation: RowValidation): "error" | "warning" | "ok" {
  if (!validation.valid) return "error"
  if (validation.warnings.length > 0) return "warning"
  return "ok"
}

export function MenuImportModal({
  open,
  onOpenChange,
  locationId,
  categories,
  menus,
  onImport,
}: MenuImportModalProps) {
  const { kdsEnabled } = useMerchantKdsEnabled()
  const [step, setStep] = useState<Step>("upload")
  const [rawRows, setRawRows] = useState<Record<string, string | undefined>[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [stationCatalog, setStationCatalog] = useState<ImportStationCatalog>([])
  const [createMissingCategories, setCreateMissingCategories] = useState(true)
  const [importAsDrafts, setImportAsDrafts] = useState(true)
  const [menuId, setMenuId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [importResult, setImportResult] = useState<{
    created: number
    skipped: number
    categoriesCreated: string[]
    errors: Array<{ row: number; field?: string; message: string }>
  } | null>(null)

  const defaultMenuId = menus[0]?.id ?? ""

  useEffect(() => {
    if (open && defaultMenuId && !menuId) {
      setMenuId(defaultMenuId)
    }
  }, [open, defaultMenuId, menuId])

  useEffect(() => {
    if (!open || !locationId || !kdsEnabled) {
      setStationCatalog([])
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/kds/stations?locationId=${encodeURIComponent(locationId)}`,
          { credentials: "include", cache: "no-store" },
        )
        if (!res.ok || cancelled) return
        const json = await res.json()
        if (!isStationSettingsView(json?.data) || cancelled) return
        setStationCatalog(
          json.data.stations.map((s) => ({
            key: s.key,
            name: s.name,
            isActive: s.isActive,
            substations: s.substations.map((ss) => ({
              key: ss.key,
              name: ss.name,
            })),
          })),
        )
      } catch {
        if (!cancelled) setStationCatalog([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, locationId, kdsEnabled])

  const stationHint = useMemo(
    () => formatStationCatalogHint(stationCatalog),
    [stationCatalog],
  )

  const menuCatalog: ImportMenuCatalog = useMemo(
    () => menus.map((m) => ({ id: m.id, name: m.name, isActive: m.isActive })),
    [menus],
  )

  const menuHint = useMemo(() => formatMenuCatalogHint(menuCatalog), [menuCatalog])

  const resetState = useCallback(() => {
    setStep("upload")
    setRawRows([])
    setFileName(null)
    setParseError(null)
    setCreateMissingCategories(true)
    setImportAsDrafts(true)
    setMenuId(defaultMenuId)
    setLoading(false)
    setImportResult(null)
  }, [defaultMenuId])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetState()
    }
    onOpenChange(nextOpen)
  }

  const plan = useMemo(() => {
    if (rawRows.length === 0) {
      return null
    }
    return buildImportPlan(
      rawRows,
      {
        createMissingCategories,
        defaultStatus: importAsDrafts ? "draft" : "live",
        menuId: menuId || undefined,
      },
      categories.map((c) => ({ id: c.id, name: c.name })),
      stationCatalog.length > 0 ? stationCatalog : undefined,
      menuCatalog.length > 0 ? menuCatalog : undefined,
    )
  }, [
    rawRows,
    createMissingCategories,
    importAsDrafts,
    menuId,
    categories,
    stationCatalog,
    menuCatalog,
  ])

  const handleFile = (file: File) => {
    setParseError(null)
    setFileName(file.name)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          setParseError(results.errors[0]?.message ?? "Failed to parse CSV")
          return
        }
        const rows = results.data.filter((row) =>
          Object.values(row).some((v) => v?.trim()),
        ) as Record<string, string | undefined>[]

        if (rows.length === 0) {
          setParseError("No data rows found in CSV")
          return
        }

        setRawRows(rows)
        setStep("preview")
      },
      error: (error) => {
        setParseError(error.message)
      },
    })
  }

  const handleImport = async () => {
    if (!plan || plan.validRows.length === 0) return

    setLoading(true)
    try {
      const result = await onImport(plan.validRows, {
        createMissingCategories,
        defaultStatus: importAsDrafts ? "draft" : "live",
        menuId: menuId || undefined,
      })
      setImportResult(result)
      setStep("result")
    } finally {
      setLoading(false)
    }
  }

  const validCount = plan?.validRows.length ?? 0
  const skippedCount = plan ? plan.validations.length - plan.validRows.length : 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import menu items from CSV</DialogTitle>
          <DialogDescription>
            Upload a spreadsheet to bulk-create menu items. The menu column links each item&apos;s
            category to guest menus (semicolon-separated for multiple). Leave menu empty to use the
            default below.
          </DialogDescription>
          {menuHint && (
            <p className="text-xs text-muted-foreground pt-1">Menus: {menuHint}</p>
          )}
          {kdsEnabled && stationHint && (
            <p className="text-xs text-muted-foreground">
              Active prep stations: {stationHint}
            </p>
          )}
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-2">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                "hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-950/20",
              )}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Drop a .csv file here or choose one from your computer
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" asChild>
                  <label className="cursor-pointer">
                    <FileUp className="h-4 w-4 mr-2" />
                    Choose file
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFile(file)
                      }}
                    />
                  </label>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => downloadMenuImportTemplate(stationCatalog, menuCatalog)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download template
                </Button>
              </div>
            </div>
            {parseError && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {parseError}
              </div>
            )}
          </div>
        )}

        {step === "preview" && plan && (
          <div className="space-y-4 flex-1 min-h-0 flex flex-col">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {fileName && <Badge variant="secondary">{fileName}</Badge>}
              <Badge variant="outline">{plan.validations.length} rows</Badge>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                {validCount} ready
              </Badge>
              {skippedCount > 0 && (
                <Badge variant="destructive">{skippedCount} will be skipped</Badge>
              )}
            </div>

            {skippedCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {skippedCount} row{skippedCount === 1 ? "" : "s"} will be skipped. {validCount} row
                {validCount === 1 ? "" : "s"} will be imported.
              </p>
            )}

            <ScrollArea className="flex-1 border rounded-md max-h-[320px]">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Row</th>
                    <th className="text-left p-2 font-medium">Name</th>
                    <th className="text-left p-2 font-medium">Price</th>
                    <th className="text-left p-2 font-medium">Category</th>
                    <th className="text-left p-2 font-medium">Menu</th>
                    <th className="text-left p-2 font-medium">Photo</th>
                    {kdsEnabled ? (
                      <>
                        <th className="text-left p-2 font-medium">Prep station</th>
                        <th className="text-left p-2 font-medium">Kitchen lane</th>
                      </>
                    ) : null}
                    <th className="text-left p-2 font-medium">Status</th>
                    <th className="text-left p-2 font-medium">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.validations.map((validation) => {
                    const status = getRowStatus(validation)
                    const row = validation.normalized
                    const issues = [...validation.errors, ...validation.warnings]
                    return (
                      <tr
                        key={validation.rowIndex}
                        className={cn(
                          "border-t",
                          status === "error" && "bg-destructive/5",
                          status === "warning" && "bg-amber-50 dark:bg-amber-950/20",
                        )}
                      >
                        <td className="p-2">{validation.rowIndex}</td>
                        <td className="p-2">{row?.name ?? "—"}</td>
                        <td className="p-2">{row?.price ?? "—"}</td>
                        <td className="p-2">{row?.category ?? "—"}</td>
                        <td className="p-2 text-xs">
                          {row?.menuNames?.join("; ") ?? (menuId ? "Default" : "—")}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground max-w-[120px] truncate">
                          {row?.photoUrl ? "Yes" : "—"}
                        </td>
                        {kdsEnabled ? (
                          <>
                            <td className="p-2 text-xs">{row?.defaultStation ?? "—"}</td>
                            <td className="p-2 text-xs">{row?.defaultSubstation ?? "—"}</td>
                          </>
                        ) : null}
                        <td className="p-2">{row?.status ?? (importAsDrafts ? "draft" : "live")}</td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {issues.length > 0 ? issues.map((i) => i.message).join("; ") : "OK"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ScrollArea>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="create-categories"
                  checked={createMissingCategories}
                  onCheckedChange={(checked) => setCreateMissingCategories(checked === true)}
                />
                <Label htmlFor="create-categories">Auto-create missing categories</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="import-drafts"
                  checked={importAsDrafts}
                  onCheckedChange={(checked) => setImportAsDrafts(checked === true)}
                />
                <Label htmlFor="import-drafts">Import as drafts</Label>
              </div>
              {menus.length > 0 && (
                <div className="space-y-2">
                  <Label>Default menu (when CSV menu column is empty)</Label>
                  <Select value={menuId} onValueChange={setMenuId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a menu" />
                    </SelectTrigger>
                    <SelectContent>
                      {menus.map((menu) => (
                        <SelectItem key={menu.id} value={menu.id}>
                          {menu.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        )}

        {step === "result" && importResult && (
          <div className="space-y-4 py-4">
            {importResult.created > 0 ? (
              <div className="flex items-center gap-3 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-8 w-8" />
                <div>
                  <p className="font-medium">Import complete</p>
                  <p className="text-sm text-muted-foreground">
                    {importResult.created} item{importResult.created === 1 ? "" : "s"} created
                    {importResult.skipped > 0 && `, ${importResult.skipped} skipped`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-8 w-8" />
                <div>
                  <p className="font-medium">Import failed</p>
                  <p className="text-sm text-muted-foreground">
                    {importResult.errors[0]?.message ?? "No items were imported"}
                  </p>
                </div>
              </div>
            )}
            {importResult.categoriesCreated.length > 0 && (
              <p className="text-sm">
                Categories created: {importResult.categoriesCreated.join(", ")}
              </p>
            )}
            {importResult.errors.length > 0 && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Skipped rows:</p>
                {importResult.errors.map((err, i) => (
                  <p key={i}>
                    Row {err.row}: {err.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={loading || validCount === 0}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${validCount} item${validCount === 1 ? "" : "s"}`
                )}
              </Button>
            </>
          )}
          {step === "result" && importResult && (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
