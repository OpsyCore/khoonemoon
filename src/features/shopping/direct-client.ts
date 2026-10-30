import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createShoppingItemSchema,
  createShoppingListSchema,
  updateShoppingItemSchema,
} from "./schemas";
import type { ShoppingItem, ShoppingList } from "./types";

// This transport talks directly to Supabase with the current user's JWT.
// The database's RLS policies, not the caller-supplied household ID, enforce access.
const LIST_COLUMNS =
  "id, household_id, name, created_by, archived_at, created_at, updated_at";
const ITEM_COLUMNS =
  "id, list_id, name, quantity, unit, category, note, added_by, purchased, purchased_by, purchased_at, position, created_at, updated_at";

async function currentUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("ابتدا وارد حساب خود شوید.");
  return data.user.id;
}

export function directShopping(client: SupabaseClient) {
  return {
    async lists(householdId: string): Promise<ShoppingList[]> {
      const { data, error } = await client
        .from("shopping_lists")
        .select(LIST_COLUMNS)
        .eq("household_id", householdId)
        .is("archived_at", null)
        .order("created_at", { ascending: true });
      if (error) throw new Error("دریافت لیست‌های خرید ناموفق بود.");
      return (data ?? []) as ShoppingList[];
    },
    async createList(
      householdId: string,
      input: unknown,
    ): Promise<ShoppingList> {
      const { name } = createShoppingListSchema.parse(input);
      const userId = await currentUserId(client);
      const { data, error } = await client
        .from("shopping_lists")
        .insert({ household_id: householdId, name, created_by: userId })
        .select(LIST_COLUMNS)
        .single();
      if (error || !data) throw new Error("ایجاد لیست خرید ناموفق بود.");
      return data as ShoppingList;
    },
    async items(listId: string): Promise<ShoppingItem[]> {
      const { data, error } = await client
        .from("shopping_items")
        .select(ITEM_COLUMNS)
        .eq("list_id", listId)
        .order("purchased", { ascending: true })
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw new Error("دریافت آیتم‌های خرید ناموفق بود.");
      return (data ?? []) as ShoppingItem[];
    },
    async addItem(input: unknown): Promise<ShoppingItem> {
      const item = createShoppingItemSchema.parse(input);
      const userId = await currentUserId(client);
      const { data, error } = await client
        .from("shopping_items")
        .insert({
          list_id: item.listId,
          name: item.name,
          quantity: item.quantity ?? null,
          unit: item.unit || null,
          category: item.category || null,
          note: item.note || null,
          added_by: userId,
        })
        .select(ITEM_COLUMNS)
        .single();
      if (error || !data) throw new Error("افزودن آیتم خرید ناموفق بود.");
      return data as ShoppingItem;
    },
    async updateItem(id: string, input: unknown): Promise<ShoppingItem> {
      const item = updateShoppingItemSchema.parse(input);
      if (!Object.keys(item).length) throw new Error("تغییری ارسال نشد.");
      const userId = await currentUserId(client);
      const { purchased, ...patch } = item;
      const update =
        purchased === undefined
          ? patch
          : {
              ...patch,
              purchased,
              purchased_by: purchased ? userId : null,
              purchased_at: purchased ? new Date().toISOString() : null,
            };
      const { data, error } = await client
        .from("shopping_items")
        .update(update)
        .eq("id", id)
        .select(ITEM_COLUMNS)
        .single();
      if (error || !data) throw new Error("به‌روزرسانی آیتم خرید ناموفق بود.");
      return data as ShoppingItem;
    },
    async deleteItem(id: string): Promise<void> {
      const { data, error } = await client
        .from("shopping_items")
        .delete()
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("حذف آیتم خرید ناموفق بود.");
    },
  };
}
