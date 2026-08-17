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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { downloadCategoryImportTemplate } from "@/lib/menu/import-category-template"
import { formatMenuCatalogHint } from "@/lib/menu/import-template"
import {
  buildCategoryImportPlan,
  type CategoryImportOptions,
  type CategoryImportRow,
  type CategoryRowValidation,
} from "@/lib/menu/import-categories"
import type { Menu } from "@/types/menu"
import type { ImportMenuCatalog } from "@/lib/menu/import-items"

type Step = "upload" | "preview" | "result"

interface CategoryImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingCategoryNames: string[]
  menus: Menu[]
  onImport: (
    rows: CategoryImportRow[],
    options: CategoryImportOptions,
  ) => Promise<{
    created: number
    skipped: number
    errors: Array<{ row: number; field?: string; message: string }>
  }>
}

function getRowStatus(validation: CategoryRowValidation): "error" | "warning" | "ok" {
  if (!validation.valid) return "error"
  if (validation.warnings.length > 0) return "warning"
  return "ok"
}

export function CategoryImportModal({
  open,
  onOpenChange,
  existingCategoryNames,
  menus,
  onImport,
}: CategoryImportModalProps) {
  const [step, setStep] = useState<Step>("upload")
  const [rawRows, setRawRows] = useState<Record<string, string | undefined>[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [skipExistingCategories, setSkipExistingCategories] = useState(true)
  const [menuId, setMenuId] = useState("")
  const [loading, setLoading] = useState(false)
  const [importResult, setImportResult] = useState<{
    created: number
    skipped: number
    errors: Array<{ row: number; field?: string; message: string }>
  } | null>(null)

  const defaultMenuId = menus[0]?.id ?? ""
  const menuCatalog: ImportMenuCatalog = useMemo(
    () => menus.map((menu) => ({ id: menu.id, name: menu.name, isActive: menu.isActive })),
    [menus],
  )
  const menuHint = useMemo(() => formatMenuCatalogHint(menuCatalog), [menuCatalog])

  useEffect(() => {
    if (open && defaultMenuId && !menuId) {
      setMenuId(defaultMenuId)
    }
  }, [open, defaultMenuId, menuId])

  const resetState = useCallback(() => {
    setStep("upload")
    setRawRows([])
    setFileName(null)
    setParseError(null)
    setSkipExistingCategories(true)
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
    if (rawRows.length === 0) return null
    return buildCategoryImportPlan(
      rawRows,
      { skipExistingCategories, menuId: menuId || undefined },
      existingCategoryNames,
      menuCatalog,
    )
  }, [rawRows, skipExistingCategories, menuId, existingCategoryNames, menuCatalog])

  const handleFile = (file: File) => {
    setParseError(null)
    setFileName(file.name)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          setParseError(results.errors[0]?.message ?? "Failed to parse CSV")
          return
        }
        const rows = results.data.filter((row) =>
          Object.values(row).some((value) => value?.trim()),
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
        skipExistingCategories,
        menuId: menuId || undefined,
      })
      setImportResult(result)
      setStep("result")
    } finally {
      setLoading(false)
    }
  }

  const validCount = plan?.validRows.length ?? 0
  const skippedCount = plan ? plan.validations.filter((validation) => !validation.valid).length : 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Import categories from CSV</DialogTitle>
          <DialogDescription>
            Upload a spreadsheet to bulk-create categories. The menu column links each category to
            guest menus (semicolon-separated for multiple). Leave menu empty to use the default
            below. Optional name_ar and description_ar columns set the Arabic guest-menu copy.
          </DialogDescription>
          {menuHint && (
            <p className="text-xs text-muted-foreground pt-1">Menus: {menuHint}</p>
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
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) handleFile(file)
                      }}
                    />
                  </label>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => downloadCategoryImportTemplate(menuCatalog)}
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
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm">
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
              <p className="shrink-0 text-sm text-muted-foreground">
                {skippedCount} row{skippedCount === 1 ? "" : "s"} will be skipped. {validCount}{" "}
                categor{validCount === 1 ? "y" : "ies"} will be imported.
              </p>
            )}

            <div className="min-h-0 flex-1 overflow-auto rounded-md border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    <th className="p-2 text-left font-medium">Row</th>
                    <th className="p-2 text-left font-medium">Name</th>
                    <th className="p-2 text-left font-medium">Arabic</th>
                    <th className="p-2 text-left font-medium">Emoji</th>
                    <th className="p-2 text-left font-medium">Description</th>
                    <th className="p-2 text-left font-medium">Menu</th>
                    <th className="p-2 text-left font-medium">Issues</th>
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
                        <td className="max-w-[140px] truncate p-2">{row?.name ?? "—"}</td>
                        <td className="max-w-[140px] truncate p-2 text-xs" dir="auto">
                          {row?.i18n?.ar?.name ?? "—"}
                        </td>
                        <td className="p-2">{row?.emoji ?? "—"}</td>
                        <td className="max-w-[180px] truncate p-2 text-xs text-muted-foreground">
                          {row?.description ?? "—"}
                        </td>
                        <td className="max-w-[160px] truncate p-2 text-xs">
                          {row?.menuNames?.join("; ") ?? (menuId ? "Default" : "—")}
                        </td>
                        <td className="max-w-[200px] p-2 text-xs text-muted-foreground">
                          {issues.length > 0 ? issues.map((issue) => issue.message).join("; ") : "OK"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="shrink-0 space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="skip-existing-categories"
                  checked={skipExistingCategories}
                  onCheckedChange={(checked) => setSkipExistingCategories(checked === true)}
                />
                <Label htmlFor="skip-existing-categories">Skip categories that already exist</Label>
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
                    {importResult.created} categor{importResult.created === 1 ? "y" : "ies"} created
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
                    {importResult.errors[0]?.message ?? "No categories were imported"}
                  </p>
                </div>
              </div>
            )}
            {importResult.errors.length > 0 && (
              <div className="max-h-40 space-y-1 overflow-y-auto text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Skipped rows:</p>
                {importResult.errors.map((err, index) => (
                  <p key={`${err.row}-${index}`}>
                    {err.row > 0 ? `Row ${err.row}: ` : ""}
                    {err.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="shrink-0">
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
                  `Import ${validCount} categor${validCount === 1 ? "y" : "ies"}`
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
