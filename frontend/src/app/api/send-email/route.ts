import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

type ReportEmailPayload = {
  to: string
  reportData: {
    companyName: string
    weekLabel: string
    weekStart: string
    weekEnd: string
    salesExVat: string
    netProfit: string
    netMarginPct: string
    grossProfit: string
    grossMarginPct: string
    labourTotal: string
    labourPct: string
    healthLabel: string
    netMarginRaw: number
    labourRaw: number
    netProfitRaw: number
    goodSignals: string[]
    warningSignals: string[]
    notes?: string
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ReportEmailPayload
    const { to, reportData } = body

    if (!to || !to.includes("@")) {
      return NextResponse.json(
        { success: false, message: "Invalid recipient email address." },
        { status: 400 }
      )
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Email service not configured. Add RESEND_API_KEY to your .env.local file.",
        },
        { status: 503 }
      )
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    const healthColor =
      reportData.netMarginRaw >= 0.18 && reportData.labourRaw <= 0.32
        ? "#10b981"
        : reportData.netMarginRaw >= 0.1
          ? "#f59e0b"
          : "#f43f5e"

    const netProfitColor = reportData.netProfitRaw > 0 ? "#10b981" : "#f43f5e"
    const netMarginColor =
      reportData.netMarginRaw >= 0.18
        ? "#10b981"
        : reportData.netMarginRaw >= 0.1
          ? "#f59e0b"
          : "#f43f5e"
    const labourColor =
      reportData.labourRaw > 0.35
        ? "#f43f5e"
        : reportData.labourRaw > 0.25
          ? "#f59e0b"
          : "#09090b"

    const signalRows = [
      ...reportData.goodSignals.map(
        (s) =>
          `<tr><td style="padding:10px 14px 10px;background:#d1fae5;border-radius:8px;font-size:12px;color:#065f46;line-height:1.5;">${s}</td></tr><tr><td style="height:6px;"></td></tr>`
      ),
      ...reportData.warningSignals.map(
        (s) =>
          `<tr><td style="padding:10px 14px 10px;background:#fef3c7;border-radius:8px;font-size:12px;color:#78350f;line-height:1.5;">${s}</td></tr><tr><td style="height:6px;"></td></tr>`
      ),
    ].join("")

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Weekly Intelligence Report — ${reportData.companyName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <tr>
        <td style="background:#09090b;padding:28px 32px;">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.02em;">MarginFlow</p>
          <p style="margin:6px 0 0;color:#a1a1aa;font-size:12px;">Weekly Intelligence Report</p>
        </td>
      </tr>

      <tr>
        <td style="padding:28px 32px 0;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#09090b;letter-spacing:-0.02em;">${reportData.companyName}</p>
          <p style="margin:6px 0 0;font-size:13px;color:#71717a;">${reportData.weekLabel}</p>
          <p style="margin:3px 0 0;font-size:12px;color:#a1a1aa;">${reportData.weekStart} → ${reportData.weekEnd}</p>
          <span style="display:inline-block;margin-top:12px;padding:5px 16px;border-radius:999px;background:${healthColor};color:#ffffff;font-size:11px;font-weight:600;">${reportData.healthLabel}</span>
        </td>
      </tr>

      <tr>
        <td style="padding:24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50%" style="padding:0 6px 12px 0;">
                <div style="background:#f4f4f5;border-radius:12px;padding:18px;">
                  <p style="margin:0;font-size:11px;color:#71717a;font-weight:500;">Sales ex VAT</p>
                  <p style="margin:8px 0 4px;font-size:22px;font-weight:700;color:#09090b;">${reportData.salesExVat}</p>
                  <p style="margin:0;font-size:10px;color:#a1a1aa;">Core revenue base</p>
                </div>
              </td>
              <td width="50%" style="padding:0 0 12px 6px;">
                <div style="background:#f4f4f5;border-radius:12px;padding:18px;">
                  <p style="margin:0;font-size:11px;color:#71717a;font-weight:500;">Net Profit</p>
                  <p style="margin:8px 0 4px;font-size:22px;font-weight:700;color:${netProfitColor};">${reportData.netProfit}</p>
                  <p style="margin:0;font-size:10px;color:#a1a1aa;">Bottom-line result</p>
                </div>
              </td>
            </tr>
            <tr>
              <td width="50%" style="padding:0 6px 0 0;">
                <div style="background:#f4f4f5;border-radius:12px;padding:18px;">
                  <p style="margin:0;font-size:11px;color:#71717a;font-weight:500;">Net Margin</p>
                  <p style="margin:8px 0 4px;font-size:22px;font-weight:700;color:${netMarginColor};">${reportData.netMarginPct}</p>
                  <p style="margin:0;font-size:10px;color:#a1a1aa;">Profitability quality</p>
                </div>
              </td>
              <td width="50%" style="padding:0 0 0 6px;">
                <div style="background:#f4f4f5;border-radius:12px;padding:18px;">
                  <p style="margin:0;font-size:11px;color:#71717a;font-weight:500;">Labour %</p>
                  <p style="margin:8px 0 4px;font-size:22px;font-weight:700;color:${labourColor};">${reportData.labourPct}</p>
                  <p style="margin:0;font-size:10px;color:#a1a1aa;">Pressure vs revenue</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:0 32px 24px;">
          <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#09090b;">Margin Snapshot</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
            <tr style="background:#f9f9f9;">
              <td style="padding:10px 16px;font-size:12px;color:#71717a;">Sales ex VAT</td>
              <td style="padding:10px 16px;font-size:12px;font-weight:700;color:#09090b;text-align:right;">${reportData.salesExVat}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-size:12px;color:#71717a;">Gross Profit</td>
              <td style="padding:10px 16px;font-size:12px;font-weight:700;text-align:right;color:${netProfitColor};">${reportData.grossProfit}</td>
            </tr>
            <tr style="background:#f9f9f9;">
              <td style="padding:10px 16px;font-size:12px;color:#71717a;">Gross Margin %</td>
              <td style="padding:10px 16px;font-size:12px;font-weight:700;color:#09090b;text-align:right;">${reportData.grossMarginPct}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-size:12px;color:#71717a;">Labour Total</td>
              <td style="padding:10px 16px;font-size:12px;font-weight:700;color:#09090b;text-align:right;">${reportData.labourTotal}</td>
            </tr>
            <tr style="background:#f9f9f9;">
              <td style="padding:10px 16px;font-size:12px;color:#71717a;">Labour %</td>
              <td style="padding:10px 16px;font-size:12px;font-weight:700;text-align:right;color:${labourColor};">${reportData.labourPct}</td>
            </tr>
            <tr style="border-top:2px solid #e4e4e7;">
              <td style="padding:12px 16px;font-size:12px;font-weight:600;color:#09090b;">Net Profit</td>
              <td style="padding:12px 16px;font-size:13px;font-weight:700;text-align:right;color:${netProfitColor};">${reportData.netProfit}</td>
            </tr>
            <tr style="background:#f9f9f9;border-top:1px solid #e4e4e7;">
              <td style="padding:12px 16px;font-size:12px;font-weight:600;color:#09090b;">Net Margin %</td>
              <td style="padding:12px 16px;font-size:13px;font-weight:700;text-align:right;color:${netMarginColor};">${reportData.netMarginPct}</td>
            </tr>
          </table>
        </td>
      </tr>

      ${
        signalRows
          ? `<tr>
        <td style="padding:0 32px 24px;">
          <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#09090b;">Key Signals</p>
          <table width="100%" cellpadding="0" cellspacing="0">${signalRows}</table>
        </td>
      </tr>`
          : ""
      }

      ${
        reportData.notes
          ? `<tr>
        <td style="padding:0 32px 24px;">
          <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#09090b;">Notes</p>
          <div style="background:#f4f4f5;border-radius:12px;padding:16px;font-size:12px;color:#71717a;line-height:1.7;">${reportData.notes.replace(/\n/g, "<br>")}</div>
        </td>
      </tr>`
          : ""
      }

      <tr>
        <td style="background:#09090b;padding:24px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#71717a;">MarginFlow · Weekly Intelligence Platform</p>
          <p style="margin:8px 0 0;font-size:10px;color:#52525b;">This report is confidential and intended for internal use only.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`

    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
    const subject = `Weekly Intelligence Report — ${reportData.companyName} · ${reportData.weekLabel}`

    const { data, error } = await resend.emails.send({
      from: `MarginFlow <${fromEmail}>`,
      to: [to],
      subject,
      html,
    })

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Report sent to ${to} successfully.`,
      id: data?.id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred."
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
