/** Intersections use an exclusive end, so midnight doesn't add an extra day. */
export function eventOverlaps(
  start: string,
  end: string,
  from: Date,
  to: Date,
): boolean {
  const a = new Date(start).getTime(),
    b = new Date(end).getTime();
  return (
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    a < to.getTime() &&
    b > from.getTime() &&
    b > a
  );
}

/** One marker for each local calendar day touched within [from,to). */
export function eventDays(
  start: string,
  end: string,
  from: Date,
  to: Date,
): Date[] {
  if (!eventOverlaps(start, end, from, to)) return [];
  const first = new Date(Math.max(new Date(start).getTime(), from.getTime()));
  const stop = Math.min(new Date(end).getTime(), to.getTime());
  const result: Date[] = [];
  let current = first;
  while (current.getTime() < stop) {
    result.push(new Date(current));
    const next = new Date(current);
    next.setHours(0, 0, 0, 0);
    next.setDate(next.getDate() + 1);
    if (next <= current) break;
    current = next;
  }
  return result;
}
