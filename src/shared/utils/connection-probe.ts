/** A network-only probe: browser online status alone cannot prove reachability. */
export async function probeConnection(
  url: string,
  headers?: Record<string, string>,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    // 404/401 are still genuine HTTP responses; server errors are not a working connection.
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
