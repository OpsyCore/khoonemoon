import { describe, expect, it } from "vitest";
import {
  matchParts,
  recentQueries,
  rememberQuery,
  resultStatus,
} from "./reference-model";

describe("search reference model", () => {
  it("keeps bounded, valid, distinct device history and moves new searches first", () => {
    expect(
      recentQueries([" خرید ", "", "خرید", 3, "x", "a".repeat(101)]),
    ).toEqual(["خرید"]);
    expect(rememberQuery(["قبض", "خرید"], "خرید")).toEqual(["خرید", "قبض"]);
    expect(
      recentQueries(["01", "02", "03", "04", "05", "06", "07"]),
    ).toHaveLength(6);
  });
  it("highlights text safely without inventing a match", () => {
    expect(matchParts("خرید شیر", "خرید")).toEqual({
      before: "",
      match: "خرید",
      after: " شیر",
    });
    expect(matchParts("<script>", "script")).toEqual({
      before: "<",
      match: "script",
      after: ">",
    });
    expect(matchParts("خانه", "قبض")).toBeNull();
  });
  it("only labels statuses that actually apply to the record kind", () => {
    expect(resultStatus("shopping_item", "PURCHASED")).toBe("خریداری شد");
    expect(resultStatus("event", "PRIVATE")).toBe("شخصی");
    expect(resultStatus("event", "COMPLETED")).toBeNull();
    expect(resultStatus("finance", "UNKNOWN")).toBeNull();
  });
});
