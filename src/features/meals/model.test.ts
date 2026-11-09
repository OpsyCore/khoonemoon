import { describe, expect, it } from "vitest";
import {
  addDays,
  fromLocalDate,
  ingredientLines,
  localDate,
  saturday,
  type Meal,
} from "./model";
import { mealInput } from "./direct-client";
describe("meal planner calendar and validation", () => {
  it("starts on Saturday and navigates local dates across year boundaries", () => {
    const date = fromLocalDate("2026-01-01");
    expect(saturday(date).getDay()).toBe(6);
    expect(localDate(addDays(fromLocalDate("2026-12-31"), 1))).toBe(
      "2027-01-01",
    );
  });
  it("aggregates real ingredient lines without duplicates", () => {
    expect(
      ingredientLines([
        { ingredients: "برنج، گوجه\nپیاز" },
        { ingredients: "پیاز, رب" },
      ] as Meal[]),
    ).toEqual(["برنج", "گوجه", "پیاز", "رب"]);
  });
  it("rejects invalid fields and unknown image choices", () => {
    const valid = {
      date: "2026-11-08",
      type: "lunch",
      title: "جوجه",
      minutes: 60,
      assignee: null,
      ingredients: null,
      image: null,
    };
    expect(mealInput.safeParse(valid).success).toBe(true);
    expect(mealInput.safeParse({ ...valid, minutes: 1441 }).success).toBe(
      false,
    );
    expect(
      mealInput.safeParse({ ...valid, image: "https://example.test/image" })
        .success,
    ).toBe(false);
  });
});
