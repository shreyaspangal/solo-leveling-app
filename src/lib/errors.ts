// Audit finding P1-2: a raw Postgres/PostgREST error (e.g. a check-
// constraint violation) names tables and constraints and is meaningless to
// the person reading it -- exactly what S6's guardrail warned a future
// Supabase-backed action would eventually do. Log the real error server-
// side, return a generic one to the client. Use this from every new data-
// mutating action rather than repeating the pattern per action.
export function toUserError(error: { message: string }, context: string): string {
  console.error(`[${context}]`, error.message);
  return "Something went wrong. Please try again.";
}
