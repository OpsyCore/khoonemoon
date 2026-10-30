/** Only same-origin paths are safe to pass to Next navigation or redirects. */
export function safeRedirectPath(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  ) {
    return "/today";
  }
  return value;
}
