// Minimal date-string helpers. All dates are "YYYY-MM-DD" and treated as UTC
// midnight so day arithmetic never gets shifted by the host machine's timezone.

function parse(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function format(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + n);
  return format(d);
}

export function daysBetween(from: string, to: string): number {
  const ms = parse(to).getTime() - parse(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function dayOfWeek(date: string): number {
  return parse(date).getUTCDay();
}

export function dayOfMonth(date: string): number {
  return parse(date).getUTCDate();
}
