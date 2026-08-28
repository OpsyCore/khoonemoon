export const THEME_OPTIONS = [
  { id: "system", label: "مطابق سیستم" },
  { id: "light", label: "روشن" },
  { id: "dark", label: "تاریک" },
] as const;

export type ThemeOptionId = (typeof THEME_OPTIONS)[number]["id"];

export function isThemeOptionId(value: string): value is ThemeOptionId {
  return THEME_OPTIONS.some((option) => option.id === value);
}
