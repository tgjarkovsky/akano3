import { sql } from "@/lib/db"
import { ensureSetupColumns } from "@/lib/setup-schema"
import type { AssignmentRule, RuleProperty, RuleSubject } from "@/lib/assignment-rules"

export async function getRules(): Promise<AssignmentRule[]> {
  await ensureSetupColumns()
  const rows = await sql`SELECT subject_type, subject_id, property, allowed FROM assignment_rules ORDER BY subject_id, property`
  return rows.map(r => ({
    subjectType: r.subject_type as RuleSubject,
    subjectId: r.subject_id as string,
    property: r.property as RuleProperty,
    allowed: r.allowed as string[],
  }))
}

/** Uloží pravidlo; allowed = null pravidlo smaže (libovolná hodnota). */
export async function saveRule(
  subjectType: RuleSubject, subjectId: string, property: RuleProperty, allowed: string[] | null, by: string | null,
) {
  await ensureSetupColumns()
  if (allowed === null) {
    await sql`DELETE FROM assignment_rules WHERE subject_type = ${subjectType} AND subject_id = ${subjectId} AND property = ${property}`
    return
  }
  await sql`
    INSERT INTO assignment_rules (subject_type, subject_id, property, allowed, updated_by)
    VALUES (${subjectType}, ${subjectId}, ${property}, ${allowed}, ${by})
    ON CONFLICT (subject_type, subject_id, property)
    DO UPDATE SET allowed = EXCLUDED.allowed, updated_by = EXCLUDED.updated_by, updated_at = NOW()
  `
}
