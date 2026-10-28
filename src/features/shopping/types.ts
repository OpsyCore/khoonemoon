export type ShoppingList = {
  id: string;
  household_id: string;
  name: string;
  created_by: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ShoppingItem = {
  id: string;
  list_id: string;
  name: string;
  quantity: number | string | null;
  unit: string | null;
  category: string | null;
  note: string | null;
  added_by: string;
  purchased: boolean;
  purchased_by: string | null;
  purchased_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export function mergeShoppingItems(
  current: ShoppingItem[],
  incoming: ShoppingItem,
): ShoppingItem[] {
  const index = current.findIndex((item) => item.id === incoming.id);

  if (index === -1) {
    return [...current, incoming].sort(compareItems);
  }

  const next = [...current];
  next[index] = incoming;
  return next.sort(compareItems);
}

export function removeShoppingItem(
  current: ShoppingItem[],
  id: string,
): ShoppingItem[] {
  return current.filter((item) => item.id !== id);
}

export function compareItems(a: ShoppingItem, b: ShoppingItem): number {
  if (a.purchased !== b.purchased) return a.purchased ? 1 : -1;
  if (a.position !== b.position) return a.position - b.position;
  return a.created_at.localeCompare(b.created_at);
}
