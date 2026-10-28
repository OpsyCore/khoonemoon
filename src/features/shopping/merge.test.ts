import { describe, expect, it } from "vitest";
import {
  mergeShoppingItems,
  removeShoppingItem,
  type ShoppingItem,
} from "./types";

function item(overrides: Partial<ShoppingItem>): ShoppingItem {
  return {
    id: "item-1",
    list_id: "list-1",
    name: "شیر",
    quantity: null,
    unit: null,
    category: null,
    note: null,
    added_by: "user-a",
    purchased: false,
    purchased_by: null,
    purchased_at: null,
    position: 0,
    created_at: "2026-10-28T10:00:00.000Z",
    updated_at: "2026-10-28T10:00:00.000Z",
    ...overrides,
  };
}

describe("mergeShoppingItems", () => {
  it("appends a new realtime item", () => {
    const merged = mergeShoppingItems(
      [item({})],
      item({ id: "item-2", name: "نان" }),
    );

    expect(merged.map((entry) => entry.id)).toEqual(["item-1", "item-2"]);
  });

  it("replaces an existing item instead of duplicating it", () => {
    const merged = mergeShoppingItems(
      [item({})],
      item({ purchased: true, purchased_at: "2026-10-28T11:00:00.000Z" }),
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].purchased).toBe(true);
  });

  it("keeps purchased items at the end of the list", () => {
    const merged = mergeShoppingItems(
      [
        item({ id: "pending", position: 1 }),
        item({ id: "purchased", purchased: true, position: 0 }),
      ],
      item({ id: "another", position: 2 }),
    );

    expect(merged.map((entry) => entry.id)).toEqual([
      "pending",
      "another",
      "purchased",
    ]);
  });

  it("orders by position when purchase state is equal", () => {
    const merged = mergeShoppingItems(
      [item({ id: "b", position: 2 })],
      item({ id: "a", position: 1 }),
    );

    expect(merged.map((entry) => entry.id)).toEqual(["a", "b"]);
  });
});

describe("removeShoppingItem", () => {
  it("drops the realtime-deleted row", () => {
    expect(
      removeShoppingItem([item({}), item({ id: "item-2" })], "item-1"),
    ).toHaveLength(1);
  });

  it("is a no-op for unknown ids", () => {
    expect(removeShoppingItem([item({})], "missing")).toHaveLength(1);
  });
});
