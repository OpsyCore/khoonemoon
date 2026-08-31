import { describe, expect, it } from "vitest";
import {
  createShoppingItemSchema,
  createShoppingListSchema,
  updateShoppingItemSchema,
  updateShoppingListSchema,
} from "@/features/shopping/schemas";

const listId = "11111111-1111-4111-8111-111111111111";

describe("shopping schemas", () => {
  it("accepts a valid list name and rejects a blank one", () => {
    expect(
      createShoppingListSchema.safeParse({ name: "نانوایی" }).success,
    ).toBe(true);
    expect(createShoppingListSchema.safeParse({ name: "   " }).success).toBe(
      false,
    );
  });

  it("requires at least one list field on update", () => {
    expect(updateShoppingListSchema.safeParse({}).success).toBe(false);
    expect(
      updateShoppingListSchema.safeParse({ isActive: false }).success,
    ).toBe(true);
  });

  it("accepts a valid item and rejects a non-uuid list id", () => {
    expect(
      createShoppingItemSchema.safeParse({
        listId,
        name: "نان",
        quantity: 2,
      }).success,
    ).toBe(true);

    expect(
      createShoppingItemSchema.safeParse({
        listId: "not-a-uuid",
        name: "نان",
      }).success,
    ).toBe(false);
  });

  it("rejects a non-positive quantity", () => {
    expect(
      createShoppingItemSchema.safeParse({
        listId,
        name: "نان",
        quantity: 0,
      }).success,
    ).toBe(false);
  });

  it("accepts a checked-state update", () => {
    expect(
      updateShoppingItemSchema.safeParse({ isChecked: true }).success,
    ).toBe(true);
    expect(updateShoppingItemSchema.safeParse({ name: "" }).success).toBe(
      false,
    );
  });
});
