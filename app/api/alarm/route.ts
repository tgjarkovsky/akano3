import { sql } from "@/lib/db"
import { ALARM_COLORS } from "@/lib/constants"
import { findActiveRunId } from "@/lib/runs"
import { noActiveRun } from "@/lib/run-status"
import { parseAlarmBody } from "@/lib/alarm-validation"

export async function POST(req: Request) {
  try {
    const parsed = parseAlarmBody(await req.json())
    if (!parsed.ok) return new Response(parsed.error, { status: 400 })
    const cmd = parsed.value
    const runId = await findActiveRunId()
    if (runId === null) return noActiveRun()

    if (cmd.action === "dismiss") {
      await sql`UPDATE alarm_state SET active = false, updated_at = NOW() WHERE run_id = ${runId}`
    } else if (cmd.action === "trigger") {
      const color = ALARM_COLORS[cmd.type]
      await sql`
        UPDATE alarm_state
        SET active = true, type = ${cmd.type}, message = ${cmd.message}, color = ${color}, updated_at = NOW()
        WHERE run_id = ${runId}
      `
    }

    return new Response(null, { status: 204 })
  } catch {
    return new Response("Server error", { status: 500 })
  }
}
