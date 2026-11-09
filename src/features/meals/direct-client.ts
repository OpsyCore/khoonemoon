import type { SupabaseClient } from "@supabase/supabase-js";
import { pendingCreate } from "@/lib/mutations/pending-create";
import { z } from "zod";
import type { Meal } from "./model";
const columns =
  "id,household_id,created_by,meal_date,meal_type,title,minutes,assignee,ingredients,image_choice,created_at,updated_at";
export const mealInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["breakfast", "lunch", "dinner"]),
  title: z.string().trim().min(1).max(120),
  minutes: z.number().int().min(0).max(1440).nullable(),
  assignee: z.string().trim().max(80).nullable(),
  ingredients: z.string().trim().max(2000).nullable(),
  image: z.enum(["breakfast", "lunch", "dinner"]).nullable(),
});
export function directMeals(client: SupabaseClient) {
  return {
    async list(householdId: string, from: string, to: string): Promise<Meal[]> {
      const { data, error } = await client
        .from("meal_plans")
        .select(columns)
        .eq("household_id", householdId)
        .gte("meal_date", from)
        .lte("meal_date", to)
        .order("meal_date")
        .order("meal_type")
        .limit(1000);
      if (error) throw new Error("دریافت برنامه غذایی ناموفق بود.");
      return (data ?? []) as Meal[];
    },
    async create(householdId: string, input: unknown): Promise<Meal> {
      const value = mealInput.parse(input);
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) throw new Error("ابتدا وارد حساب شوید.");
      const user = data.user.id;
      const fields = {
        household_id: householdId,
        created_by: user,
        meal_date: value.date,
        meal_type: value.type,
        title: value.title,
        minutes: value.minutes,
        assignee: value.assignee || null,
        ingredients: value.ingredients || null,
        image_choice: value.image,
      };
      return pendingCreate<Meal>({
        user,
        kind: "meal-plan",
        input: fields,
        submit: (id) =>
          client
            .from("meal_plans")
            .insert({ id, ...fields })
            .select(columns)
            .single(),
        find: (id) =>
          client.from("meal_plans").select(columns).eq("id", id).maybeSingle(),
      });
    },
    async update(existing: Meal, input: unknown): Promise<void> {
      const v = mealInput.parse(input);
      const { data, error } = await client
        .from("meal_plans")
        .update({
          meal_date: v.date,
          meal_type: v.type,
          title: v.title,
          minutes: v.minutes,
          assignee: v.assignee || null,
          ingredients: v.ingredients || null,
          image_choice: v.image,
        })
        .eq("id", existing.id)
        .eq("updated_at", existing.updated_at)
        .select("id")
        .maybeSingle();
      if (error || !data)
        throw new Error("ویرایش تأیید نشد؛ فهرست را تازه کنید.");
    },
    async remove(existing: Meal): Promise<void> {
      const { data, error } = await client
        .from("meal_plans")
        .delete()
        .eq("id", existing.id)
        .eq("updated_at", existing.updated_at)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("حذف تأیید نشد؛ فهرست را تازه کنید.");
    },
  };
}
