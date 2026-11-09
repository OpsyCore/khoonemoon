export const mealTypes = ["breakfast", "lunch", "dinner"] as const;
export type MealType = (typeof mealTypes)[number];
export type Meal = {
  id: string;
  household_id: string;
  created_by: string;
  meal_date: string;
  meal_type: MealType;
  title: string;
  minutes: number | null;
  assignee: string | null;
  ingredients: string | null;
  image_choice: MealType | null;
  updated_at: string;
  created_at: string;
};
export const mealNames: Record<MealType, string> = {
  breakfast: "صبحانه",
  lunch: "ناهار",
  dinner: "شام",
};
export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function fromLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
export function addDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + days);
  return value;
}
export function saturday(date: Date): Date {
  return addDays(date, -((date.getDay() + 1) % 7));
}
export function ingredientLines(meals: Meal[]): string[] {
  return [
    ...new Set(
      meals.flatMap((m) =>
        (m.ingredients ?? "")
          .split(/[\n،,]+/)
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ),
  ];
}
