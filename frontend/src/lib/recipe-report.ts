import type { RecipeDetailResponse } from "@/services/api"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

export type RecipeReportOptions = {
  includeCosts: boolean
  includeNotes: boolean
  includePhoto: boolean
  includePricingSummary: boolean
}

type RecipeReportBuildParams = {
  companyName: string
  recipe: RecipeDetailResponse
  options: RecipeReportOptions
  generatedAt?: Date
}

type PdfColor = [number, number, number]

const COLORS = {
  slate950: [15, 23, 42] as PdfColor,
  slate800: [30, 41, 59] as PdfColor,
  slate700: [51, 65, 85] as PdfColor,
  slate500: [100, 116, 139] as PdfColor,
  slate400: [148, 163, 184] as PdfColor,
  border: [226, 232, 240] as PdfColor,
  panel: [248, 250, 252] as PdfColor,
  soft: [241, 245, 249] as PdfColor,
  green: [99, 153, 34] as PdfColor,
}

function slugify(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "recipe"
  )
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "-"
  return `${value.toFixed(1)}%`
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value)
}

function formatDateStamp(value: Date) {
  return value.toISOString().slice(0, 10)
}

function cleanText(value?: string | null) {
  return (value ?? "").trim()
}

function resolvePhotoUrl(value: string) {
  if (!value) return value
  if (value.startsWith("data:")) return value
  if (value.startsWith("http://") || value.startsWith("https://")) return value
  if (value.startsWith("/")) {
    return `${API_URL.replace(/\/$/, "")}${value}`
  }
  return value
}

async function loadImageAsPngDataUrl(url: string): Promise<string | null> {
  const isDataUrl = url.startsWith("data:")
  let objectUrl: string | null = null

  try {
    let src = url

    if (!isDataUrl) {
      const response = await fetch(url, { mode: "cors", cache: "no-store" })
      if (!response.ok) return null
      const blob = await response.blob()
      objectUrl = URL.createObjectURL(blob)
      src = objectUrl
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error("Image failed to load"))
      img.src = src
    })

    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth || 1200
    canvas.height = image.naturalHeight || 800

    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    ctx.drawImage(image, 0, 0)

    return canvas.toDataURL("image/png")
  } catch {
    return null
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
    }
  }
}

function computeLineCost(
  row: RecipeDetailResponse["ingredients"][number],
  totalEx: number,
  totalInc: number
) {
  return {
    costEx: row.line_cost_ex_vat ?? null,
    costInc: row.line_cost_inc_vat ?? null,
    share:
      row.line_cost_ex_vat != null && totalEx > 0 ? (row.line_cost_ex_vat / totalEx) * 100 : null,
  }
}

function ensurePageSpace(
  doc: any,
  y: number,
  height: number,
  options: { top: number; bottom: number },
  onPageBreak?: () => void
) {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + height <= pageHeight - options.bottom) return y
  doc.addPage()
  onPageBreak?.()
  return options.top
}

function estimateSectionHeadingHeight(doc: any, subtitle: string | null, width: number) {
  if (!subtitle) return 5.6
  const lines = doc.splitTextToSize(subtitle, width)
  return 6 + lines.length * 3.9
}

function estimateWrappedBlockHeight(
  doc: any,
  text: string,
  width: number,
  lineHeight: number,
  minHeight: number
) {
  const lines = doc.splitTextToSize(text, width)
  return Math.max(minHeight, lines.length * lineHeight + 8)
}

function measureIngredientRowHeight(
  doc: any,
  row: RecipeDetailResponse["ingredients"][number],
  widths: number[],
  includeCosts: boolean
) {
  const ingredientWidth = widths[0]
  const sourceWidth = widths[includeCosts ? 5 : 3]
  const ingredientLines = doc.splitTextToSize(row.ingredient_name, ingredientWidth - 4)
  const supplierName = cleanText(row.source_supplier_name)
  const sourceText = supplierName
    ? `${supplierName}${row.source_purchase_date ? ` · ${new Intl.DateTimeFormat("en-IE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(row.source_purchase_date))}` : ""}`
    : "-"
  const sourceLines = doc.splitTextToSize(sourceText, sourceWidth - 4)

  return {
    height: Math.max(ingredientLines.length, sourceLines.length, 1) * 4.6 + 4,
    ingredientLines,
    sourceLines,
  }
}

function drawRepeatedHeader(doc: any, pageWidth: number, margin: number, reportTitle: string, recipeName: string) {
  doc.setFillColor(...COLORS.slate950)
  doc.rect(0, 0, pageWidth, 12, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.setTextColor(255, 255, 255)
  doc.text(recipeName, margin, 7.2)
  doc.text(reportTitle, pageWidth - margin, 7.2, { align: "right" })
  doc.setDrawColor(...COLORS.border)
  doc.line(margin, 14, pageWidth - margin, 14)
}

function drawFooter(doc: any, pageWidth: number, pageHeight: number, margin: number, companyName: string) {
  const pageCount = doc.getNumberOfPages()
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(...COLORS.slate500)

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(...COLORS.border)
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
    doc.text(`Generated by MarginFlow · ${companyName}`, margin, pageHeight - 6.2)
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 6.2, { align: "right" })
  }
}

function drawSectionHeading(
  doc: any,
  title: string,
  subtitle: string | null,
  x: number,
  y: number,
  width: number
) {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(...COLORS.slate950)
  doc.text(title.toUpperCase(), x, y)
  doc.setDrawColor(...COLORS.slate950)
  doc.line(x, y + 1.8, x + 18, y + 1.8)
  if (subtitle) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...COLORS.slate500)
    const lines = doc.splitTextToSize(subtitle, width)
    doc.text(lines, x, y + 6)
    return y + 6 + lines.length * 3.9
  }
  return y + 5.6
}

function drawMetricCard(
  doc: any,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  subtitle?: string | null,
  tone: "default" | "green" = "default"
) {
  doc.setFillColor(...COLORS.panel)
  doc.setDrawColor(...COLORS.border)
  doc.roundedRect(x, y, width, height, 3, 3, "FD")
  if (tone === "green") {
    doc.setFillColor(...COLORS.green)
    doc.circle(x + 4.2, y + 4.2, 1.2, "F")
  }
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.6)
  doc.setTextColor(...COLORS.slate500)
  doc.text(label.toUpperCase(), x + 6.2, y + 5.1)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11.5)
  doc.setTextColor(...COLORS.slate950)
  doc.text(value, x + 3.2, y + 11.2)
  if (subtitle) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.2)
    doc.setTextColor(...COLORS.slate400)
    const lines = doc.splitTextToSize(subtitle, width - 6.4)
    doc.text(lines, x + 3.2, y + height - 3.8)
  }
}

function drawKeyValueRow(
  doc: any,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string
) {
  const labelWidth = width * 0.42
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.4)
  doc.setTextColor(...COLORS.slate500)
  doc.text(label, x, y)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9.2)
  doc.setTextColor(...COLORS.slate950)
  const lines = doc.splitTextToSize(value || "-", width - labelWidth)
  doc.text(lines, x + labelWidth, y)
  return Math.max(5.3, lines.length * 4.2)
}

function drawIngredientsHeader(
  doc: any,
  x: number,
  y: number,
  widths: number[],
  includeCosts: boolean
) {
  doc.setFillColor(...COLORS.slate950)
  doc.roundedRect(x, y, widths.reduce((a, b) => a + b, 0), 8, 2.5, 2.5, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.6)
  doc.setTextColor(255, 255, 255)

  const headers = includeCosts
    ? ["Ingredient", "Qty", "Unit", "Unit cost", "Line cost", "Price source"]
    : ["Ingredient", "Qty", "Unit", "Price source"]

  let cursor = x + 2.5
  headers.forEach((header, index) => {
    const cellWidth = widths[index]
    const align = index >= headers.length - 2 ? "right" : "left"
    doc.text(header.toUpperCase(), align === "right" ? cursor + cellWidth - 2.5 : cursor, y + 5.1, {
      align,
    })
    cursor += cellWidth
  })
  return y + 9.5
}

function drawIngredientRow(
  doc: any,
  x: number,
  y: number,
  widths: number[],
  row: RecipeDetailResponse["ingredients"][number],
  includeCosts: boolean,
  totalEx: number,
  totalInc: number
) {
  const ingredientWidth = widths[0]
  const qtyWidth = widths[1]
  const unitWidth = widths[2]
  const sourceWidth = widths[includeCosts ? 5 : 3]
  const rowMetric = computeLineCost(row, totalEx, totalInc)

  const ingredientLines = doc.splitTextToSize(row.ingredient_name, ingredientWidth - 4)
  const sourceText = cleanText(row.source_supplier_name)
    ? `${cleanText(row.source_supplier_name)}${row.source_purchase_date ? ` · ${new Intl.DateTimeFormat("en-IE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(row.source_purchase_date))}` : ""}`
    : "-"
  const sourceLines = doc.splitTextToSize(sourceText, sourceWidth - 4)
  const height = Math.max(ingredientLines.length, sourceLines.length, 1) * 4.6 + 4

  doc.setDrawColor(...COLORS.border)
  doc.setFillColor(255, 255, 255)
  doc.rect(x, y, widths.reduce((a, b) => a + b, 0), height, "FD")
  doc.setTextColor(...COLORS.slate950)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.6)

  const ingredientY = y + 4
  doc.text(ingredientLines, x + 2, ingredientY)
  doc.text(String(row.quantity_required ?? 0), x + ingredientWidth + qtyWidth - 2, ingredientY, { align: "right" })
  doc.text(row.unit_used, x + ingredientWidth + qtyWidth + unitWidth - 2, ingredientY, { align: "right" })

  let cursor = x + ingredientWidth + qtyWidth + unitWidth
  if (includeCosts) {
    const unitCostWidth = widths[3]
    const lineCostWidth = widths[4]
    doc.text(
      row.latest_unit_cost_ex_vat == null ? "-" : formatCurrency(row.latest_unit_cost_ex_vat),
      cursor + unitCostWidth - 2,
      ingredientY,
      { align: "right" }
    )
    cursor += unitCostWidth
    doc.text(
      row.line_cost_ex_vat == null ? "-" : formatCurrency(row.line_cost_ex_vat),
      cursor + lineCostWidth - 2,
      ingredientY,
      { align: "right" }
    )
    cursor += lineCostWidth
  }

  doc.setTextColor(...COLORS.slate700)
  const sourceX = x + widths.slice(0, includeCosts ? 5 : 3).reduce((a, b) => a + b, 0)
  doc.text(sourceLines, sourceX + 2, ingredientY)

  if (rowMetric.share != null) {
    doc.setFontSize(7.2)
    doc.setTextColor(...COLORS.slate400)
    doc.text(`${rowMetric.share.toFixed(1)}%`, x + widths.reduce((a, b) => a + b, 0) - 2, y + height - 2.8, {
      align: "right",
    })
  }

  return height
}

async function preparePhoto(photoUrl?: string | null, includePhoto?: boolean) {
  const value = cleanText(photoUrl)
  if (!includePhoto || !value) return null
  return loadImageAsPngDataUrl(resolvePhotoUrl(value))
}

export function buildRecipeReportFileName(recipeName: string, generatedAt = new Date()) {
  return `recipe-${slugify(recipeName)}-${formatDateStamp(generatedAt)}.pdf`
}

export async function generateRecipeReportPdf({
  companyName,
  recipe,
  options,
  generatedAt = new Date(),
}: RecipeReportBuildParams): Promise<{ blob: Blob; fileName: string }> {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentTop = 19
  const footerSafeBottom = 22
  const contentWidth = pageWidth - margin * 2
  const reportTitle = options.includeCosts ? "Recipe Cost Sheet" : "Recipe Technical Sheet"
  const recipeName = cleanText(recipe.recipe.recipe_name) || "Untitled recipe"
  const category = cleanText(recipe.recipe.category) || "Uncategorised"
  const exportDate = formatDate(generatedAt)
  const status = recipe.recipe.is_active ? "Active" : "Inactive"
  const photo = await preparePhoto(recipe.recipe.photo_url, options.includePhoto)
  const hasSellingPrice = typeof recipe.recipe.selling_price_ex_vat === "number" && recipe.recipe.selling_price_ex_vat > 0
  const hasNotes = options.includeNotes && Boolean(cleanText(recipe.recipe.notes))
  const includePricingSummary = options.includePricingSummary && hasSellingPrice

  let y = 0
  const startFirstPage = () => {
    doc.setFillColor(...COLORS.slate950)
    doc.rect(0, 0, pageWidth, 18, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    doc.text("MarginFlow", margin, 11)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.2)
    doc.text(companyName, pageWidth - margin, 10.8, { align: "right" })
    doc.text(exportDate, pageWidth - margin, 14.6, { align: "right" })

    y = 28
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9.5)
    doc.setTextColor(...COLORS.slate500)
    doc.text(reportTitle.toUpperCase(), margin, y)
    y += 8
    doc.setFontSize(22)
    doc.setTextColor(...COLORS.slate950)
    doc.text(recipeName, margin, y)
    y += 8.5

    doc.setFont("helvetica", "normal")
    doc.setFontSize(10.2)
    doc.setTextColor(...COLORS.slate700)
    doc.text(`${category} · ${status}`, margin, y)
    y += 8
  }

  const addContinuationPage = () => {
    doc.addPage()
    drawRepeatedHeader(doc, pageWidth, margin, reportTitle, recipeName)
    y = contentTop
  }

  const drawSummaryBlock = () => {
    const heroY = y + 1
    const photoW = photo ? 76 : 0
    const photoH = photo ? 52 : 0
    const gap = photo ? 6 : 0
    const cardX = margin + photoW + gap
    const cardW = photo ? contentWidth - photoW - gap : contentWidth
    const cards: Array<{ label: string; value: string; subtitle?: string | null; tone?: "default" | "green" }> = [
      { label: "Yield", value: `${recipe.recipe.yield_quantity} ${recipe.recipe.yield_unit}` },
      ...(recipe.recipe.portion_size != null
        ? [{ label: "Portion size", value: `${recipe.recipe.portion_size}` }]
        : []),
      { label: "Wastage", value: formatPercent(recipe.recipe.wastage_percent) },
      { label: "Status", value: status },
      ...(options.includeCosts
        ? [
            { label: "Cost per yield", value: formatCurrency(recipe.recipe.cost_per_yield_ex_vat) },
            { label: "Cost per portion", value: formatCurrency(recipe.recipe.cost_per_portion_ex_vat) },
            { label: "Food cost %", value: formatPercent(recipe.recipe.food_cost_percent) },
          ]
        : []),
      ...(includePricingSummary
        ? [
            { label: "Selling price ex VAT", value: formatCurrency(recipe.recipe.selling_price_ex_vat) },
            { label: "Selling price inc VAT", value: formatCurrency(recipe.recipe.selling_price_inc_vat) },
          ]
        : []),
    ]

    const cardCols = 2
    const cardGap = 3
    const cardWidth = (cardW - cardGap * (cardCols - 1)) / cardCols
    const cardHeight = 14.5
    const cardRows = Math.ceil(cards.length / cardCols)
    const cardAreaH = cardRows * cardHeight + Math.max(0, cardRows - 1) * cardGap

    if (photo) {
      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(...COLORS.border)
      doc.roundedRect(margin, heroY, photoW, photoH, 3, 3, "FD")
      doc.addImage(photo, "PNG", margin + 1.5, heroY + 1.5, photoW - 3, photoH - 3, undefined, "FAST")
      doc.setFillColor(...COLORS.slate950)
      doc.roundedRect(margin + 2.5, heroY + photoH - 10, photoW - 5, 7.5, 2, 2, "F")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(7.4)
      doc.setTextColor(255, 255, 255)
      doc.text(recipeName, margin + 5, heroY + photoH - 5)
    }

    cards.forEach((card, index) => {
      const row = Math.floor(index / cardCols)
      const col = index % cardCols
      const x = cardX + col * (cardWidth + cardGap)
      const yy = heroY + row * (cardHeight + cardGap)
      drawMetricCard(doc, x, yy, cardWidth, cardHeight, card.label, card.value, card.subtitle ?? null, card.tone ?? "default")
    })

    y = heroY + Math.max(photoH, cardAreaH) + 6
  }

  const drawOverview = () => {
    y = ensurePageSpace(doc, y, 48, { top: contentTop, bottom: footerSafeBottom })
    y = drawSectionHeading(doc, "Recipe overview", "Core recipe setup and presentation data.", margin, y, contentWidth)

    const leftWidth = (contentWidth - 4) / 2
    const rightX = margin + leftWidth + 4
    const leftEntries = [
      ["Recipe name", recipeName],
      ["Category", category],
      ["Yield", `${recipe.recipe.yield_quantity} ${recipe.recipe.yield_unit}`],
      ["Portion size", recipe.recipe.portion_size != null ? `${recipe.recipe.portion_size}` : "-"],
      ["Wastage", formatPercent(recipe.recipe.wastage_percent)],
    ]
    const rightEntries = [
      ["Selling price ex VAT", formatCurrency(recipe.recipe.selling_price_ex_vat)],
      ["Selling price inc VAT", formatCurrency(recipe.recipe.selling_price_inc_vat)],
      ["Labour override", recipe.recipe.labour_cost_override != null ? formatCurrency(recipe.recipe.labour_cost_override) : "-"],
      ["Packaging override", recipe.recipe.packaging_cost_override != null ? formatCurrency(recipe.recipe.packaging_cost_override) : "-"],
      ["Active status", status],
    ]

    const panelTop = y + 1
    const panelHeight = Math.max(leftEntries.length, rightEntries.length) * 6.4 + 8
    doc.setFillColor(...COLORS.panel)
    doc.setDrawColor(...COLORS.border)
    doc.roundedRect(margin, panelTop, leftWidth, panelHeight, 3, 3, "FD")
    doc.roundedRect(rightX, panelTop, leftWidth, panelHeight, 3, 3, "FD")

    let leftY = panelTop + 6
    leftEntries.forEach(([label, value]) => {
      leftY += drawKeyValueRow(doc, margin + 3, leftY, leftWidth - 6, label, value)
      leftY += 1.4
    })

    let rightY = panelTop + 6
    rightEntries.forEach(([label, value]) => {
      rightY += drawKeyValueRow(doc, rightX + 3, rightY, leftWidth - 6, label, value)
      rightY += 1.4
    })

    y = panelTop + panelHeight + 6
  }

  const drawIngredients = () => {
    const includeCosts = options.includeCosts
    const widths = includeCosts
      ? [56, 16, 14, 24, 24, 48]
      : [68, 18, 16, 80]
    const sectionTitle = includeCosts ? "Ingredients" : "Ingredients"
    y = ensurePageSpace(doc, y, 24, { top: contentTop, bottom: footerSafeBottom }, () =>
      drawRepeatedHeader(doc, pageWidth, margin, reportTitle, recipeName)
    )
    y = drawSectionHeading(
      doc,
      sectionTitle,
      includeCosts ? "Ingredient costing includes unit and line costs." : "Ingredient list is shown without costing values.",
      margin,
      y,
      contentWidth
    )
    y = drawIngredientsHeader(doc, margin, y + 1.5, widths, includeCosts)

    recipe.ingredients.forEach((row) => {
      const rowHeightEstimate = measureIngredientRowHeight(
        doc,
        row,
        widths,
        includeCosts
      ).height
      y = ensurePageSpace(doc, y, rowHeightEstimate + 2.2, { top: contentTop, bottom: footerSafeBottom }, () =>
        drawRepeatedHeader(doc, pageWidth, margin, reportTitle, recipeName)
      )
      if (y === contentTop) {
        y = drawSectionHeading(
          doc,
          `${sectionTitle} (continued)`,
          includeCosts ? "Ingredient costing continues on the next page." : "Ingredient list continues on the next page.",
          margin,
          y,
          contentWidth
        )
        y = drawIngredientsHeader(doc, margin, y + 1.5, widths, includeCosts)
      }
      const rowHeight = drawIngredientRow(
        doc,
        margin,
        y,
        widths,
        row,
        includeCosts,
        recipe.recipe.total_recipe_cost_ex_vat ?? 0,
        recipe.recipe.total_recipe_cost_inc_vat ?? 0
      )
      y += rowHeight + 1.6
    })
    y += 4
  }

  const drawMethod = () => {
    const methodText = cleanText(recipe.recipe.description)
    if (!methodText) return
    const bodyHeight = estimateWrappedBlockHeight(doc, methodText, contentWidth - 10, 4.6, 16)
    const headingHeight = estimateSectionHeadingHeight(
      doc,
      "Preparation notes and operating method.",
      contentWidth
    )
    y = ensurePageSpace(doc, y, headingHeight + 1 + bodyHeight + 6, { top: contentTop, bottom: footerSafeBottom }, () =>
      drawRepeatedHeader(doc, pageWidth, margin, reportTitle, recipeName)
    )
    y = drawSectionHeading(doc, "Method / description", "Preparation notes and operating method.", margin, y, contentWidth)
    const cardTop = y + 1
    const lines = doc.splitTextToSize(methodText, contentWidth - 10)
    const height = bodyHeight
    doc.setFillColor(...COLORS.soft)
    doc.setDrawColor(...COLORS.border)
    doc.roundedRect(margin, cardTop, contentWidth, height, 3, 3, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9.2)
    doc.setTextColor(...COLORS.slate800)
    doc.text(lines, margin + 5, cardTop + 6)
    y = cardTop + height + 6
  }

  const drawNotes = () => {
    const notesText = cleanText(recipe.recipe.notes)
    if (!options.includeNotes || !notesText) return
    const bodyHeight = estimateWrappedBlockHeight(doc, notesText, contentWidth - 10, 4.6, 14)
    const headingHeight = estimateSectionHeadingHeight(doc, "Allergen, service, and internal notes.", contentWidth)
    y = ensurePageSpace(doc, y, headingHeight + 1 + bodyHeight + 6, { top: contentTop, bottom: footerSafeBottom }, () =>
      drawRepeatedHeader(doc, pageWidth, margin, reportTitle, recipeName)
    )
    y = drawSectionHeading(doc, "Notes", "Allergen, service, and internal notes.", margin, y, contentWidth)
    const lines = doc.splitTextToSize(notesText, contentWidth - 10)
    const height = bodyHeight
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...COLORS.border)
    doc.roundedRect(margin, y + 1, contentWidth, height, 3, 3, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9.2)
    doc.setTextColor(...COLORS.slate800)
    doc.text(lines, margin + 5, y + 7)
    y += height + 7
  }

  const drawPricingSummary = () => {
    if (!options.includePricingSummary && !options.includeCosts) return
    const showFullCostSummary = options.includeCosts
    const subtitle = showFullCostSummary
      ? "Summary of recipe economics for management use."
      : "Pricing summary for management visibility."
    const cardCols = 2
    const cardGap = 4
    const cardH = 16
    const cards: Array<{ label: string; value: string; tone?: "default" | "green" }> = [
      { label: "Selling price ex VAT", value: formatCurrency(recipe.recipe.selling_price_ex_vat) },
      { label: "Selling price inc VAT", value: formatCurrency(recipe.recipe.selling_price_inc_vat) },
    ]

    if (showFullCostSummary) {
      cards.push({ label: "Total recipe cost ex VAT", value: formatCurrency(recipe.recipe.total_recipe_cost_ex_vat) })
      cards.push({ label: "Cost per yield", value: formatCurrency(recipe.recipe.cost_per_yield_ex_vat) })
      cards.push({ label: "Cost per portion", value: formatCurrency(recipe.recipe.cost_per_portion_ex_vat) })
      cards.push({ label: "Food cost %", value: formatPercent(recipe.recipe.food_cost_percent), tone: "green" })
      if (
        recipe.recipe.selling_price_ex_vat != null &&
        recipe.recipe.cost_per_portion_ex_vat != null
      ) {
        cards.push({
          label: "Gross contribution per portion",
          value: formatCurrency(recipe.recipe.selling_price_ex_vat - recipe.recipe.cost_per_portion_ex_vat),
        })
      }
    }

    const rows = Math.ceil(cards.length / cardCols)
    const headingHeight = estimateSectionHeadingHeight(doc, subtitle, contentWidth)
    const cardsHeight = rows * cardH + Math.max(0, rows - 1) * 4 + 5
    addContinuationPage()
    y = ensurePageSpace(doc, y, headingHeight + 1 + cardsHeight + 2, { top: contentTop, bottom: footerSafeBottom }, () =>
      drawRepeatedHeader(doc, pageWidth, margin, reportTitle, recipeName)
    )
    y = drawSectionHeading(doc, "Cost summary", subtitle, margin, y, contentWidth)
    const cardW = (contentWidth - cardGap) / cardCols
    cards.forEach((card, index) => {
      const row = Math.floor(index / cardCols)
      const col = index % cardCols
      const x = margin + col * (cardW + cardGap)
      const yy = y + 1 + row * (cardH + 4)
      drawMetricCard(doc, x, yy, cardW, cardH, card.label, card.value, null, card.tone ?? "default")
    })
    y += rows * (cardH + 4) + 8
  }

  startFirstPage()
  drawSummaryBlock()
  drawOverview()
  drawIngredients()
  drawMethod()
  drawNotes()
  drawPricingSummary()

  drawFooter(doc, pageWidth, pageHeight, margin, companyName)

  const blob = doc.output("blob")
  const fileName = buildRecipeReportFileName(recipe.recipe.recipe_name, generatedAt)
  return { blob, fileName }
}

export async function downloadRecipeReportPdf(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function printRecipeReportPdf(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const preview = window.open("", "_blank", "width=1280,height=900")

  if (!preview) {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return
  }

  const safeTitle = `MarginFlow Recipe Report`
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      html, body { margin: 0; width: 100%; height: 100%; background: #f8fafc; }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Helvetica, Arial, sans-serif;
        color: #334155;
      }
      .wrap {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      .status {
        padding: 16px 20px;
        font-size: 12px;
        border-bottom: 1px solid #e2e8f0;
        background: #ffffff;
      }
      iframe {
        border: 0;
        width: 100%;
        height: calc(100vh - 49px);
        background: #ffffff;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="status">Preparing recipe PDF for printing...</div>
      <iframe id="recipe-report-frame" src="${url}" title="Recipe report PDF"></iframe>
    </div>
    <script>
      const frame = document.getElementById('recipe-report-frame');
      const printWhenReady = () => {
        try {
          window.focus();
          window.print();
        } catch (error) {
          console.error(error);
        }
      };
      frame.addEventListener('load', () => {
        setTimeout(printWhenReady, 300);
      });
    </script>
  </body>
</html>`

  preview.document.open()
  preview.document.write(html)
  preview.document.close()
  preview.focus()

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
