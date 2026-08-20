export type ShoppingItem = {
  id: string;
  list_id: string;
  created_by: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  is_checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ShoppingList = {
  id: string;
  household_id: string;
  created_by: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  shopping_items?: ShoppingItem[];
};
