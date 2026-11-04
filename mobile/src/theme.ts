export type ThemeMode = "light" | "dark" | "system";
export const THEME_KEY = "khoonemoon:theme";
export function parseTheme(value: string | null): ThemeMode {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}
export function resolveTheme(
  mode: ThemeMode,
  prefersDark: boolean,
): "light" | "dark" {
  return mode === "system" ? (prefersDark ? "dark" : "light") : mode;
}
export function readTheme(storage: Pick<Storage, "getItem">): ThemeMode {
  try {
    return parseTheme(storage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}
export function writeTheme(
  storage: Pick<Storage, "setItem">,
  value: ThemeMode,
): boolean {
  try {
    storage.setItem(THEME_KEY, value);
    return true;
  } catch {
    return false;
  }
}
