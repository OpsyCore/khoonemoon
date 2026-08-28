import { describe, expect, it } from "vitest";
import { searchAccessibleRecords, type SearchDataClient } from "./server";

function clientFor(tables: Record<string, unknown[]>) {
  const queried: string[] = [];
  const client: SearchDataClient = {
    from(table: string) {
      queried.push(table);
      const query = {
        select() {
          return query;
        },
        is() {
          return query;
        },
        eq() {
          return query;
        },
        or() {
          return query;
        },
        limit() {
          return Promise.resolve({
            data: tables[table] ?? [],
            error: null,
          });
        },
      };
      return query;
    },
  };
  return { client, queried };
}

describe("searchAccessibleRecords", () => {
  it("queries only finance when type is finance", async () => {
    const { client, queried } = clientFor({
      finance_records: [{ id: "f1", title: "نان", category: null, note: null }],
    });
    const results = await searchAccessibleRecords({
      client,
      query: "نان",
      type: "finance",
    });
    expect(queried).toEqual(["finance_records"]);
    expect(results.map((item) => item.type)).toEqual(["finance"]);
  });
});
