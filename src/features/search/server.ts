import {
  SEARCH_PER_TYPE_LIMIT,
  SEARCH_RESULT_LIMIT,
  toOrIlikeFilter,
} from "@/features/search/query";
import { mergeSearchResults, snippetOf } from "@/features/search/rank";
import type {
  SearchEntityType,
  SearchResult,
  SearchTypeFilter,
} from "@/features/search/types";

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

type SearchFilterBuilder = {
  select: (columns: string) => SearchFilterBuilder;
  is: (column: string, value: null) => SearchFilterBuilder;
  eq: (column: string, value: string | boolean) => SearchFilterBuilder;
  or: (filters: string) => SearchFilterBuilder;
  limit: (count: number) => PromiseLike<QueryResult>;
};

export type SearchDataClient = {
  from: (table: string) => SearchFilterBuilder;
};

type TextRow = {
  id?: unknown;
  title?: unknown;
  name?: unknown;
  description?: unknown;
  location?: unknown;
  note?: unknown;
  category?: unknown;
  list_id?: unknown;
};

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asId(value: unknown) {
  return typeof value === "string" ? value : "";
}

function wanted(type: SearchTypeFilter, entity: SearchEntityType) {
  return type === "all" || type === entity;
}

async function collect(
  promise: PromiseLike<QueryResult>,
  map: (rows: TextRow[]) => SearchResult[],
) {
  const { data, error } = await promise;
  if (error) {
    throw new Error(error.message || "SEARCH_QUERY_FAILED");
  }
  return map((data ?? []) as TextRow[]);
}

export async function searchAccessibleRecords({
  client,
  query,
  type,
}: {
  client: SearchDataClient;
  query: string;
  type: SearchTypeFilter;
}): Promise<SearchResult[]> {
  const limit = SEARCH_PER_TYPE_LIMIT;
  const jobs: Array<Promise<SearchResult[]>> = [];

  if (wanted(type, "task")) {
    jobs.push(
      collect(
        client
          .from("tasks")
          .select("id, title, description")
          .is("archived_at", null)
          .or(toOrIlikeFilter(["title", "description"], query))
          .limit(limit),
        (rows) =>
          rows.map((row) => ({
            type: "task" as const,
            id: asId(row.id),
            title: asText(row.title),
            snippet: snippetOf(asText(row.description)),
            href: "/today",
          })),
      ),
    );
  }

  if (wanted(type, "chore")) {
    jobs.push(
      collect(
        client
          .from("chores")
          .select("id, title, description")
          .or(toOrIlikeFilter(["title", "description"], query))
          .limit(limit),
        (rows) =>
          rows.map((row) => ({
            type: "chore" as const,
            id: asId(row.id),
            title: asText(row.title),
            snippet: snippetOf(asText(row.description)),
            href: "/home#chores",
          })),
      ),
    );
  }

  if (wanted(type, "shopping_list")) {
    jobs.push(
      collect(
        client
          .from("shopping_lists")
          .select("id, name")
          .eq("is_active", true)
          .or(toOrIlikeFilter(["name"], query))
          .limit(limit),
        (rows) =>
          rows.map((row) => ({
            type: "shopping_list" as const,
            id: asId(row.id),
            title: asText(row.name),
            snippet: null,
            href: "/lists",
          })),
      ),
    );
  }

  if (wanted(type, "shopping_item")) {
    jobs.push(
      collect(
        client
          .from("shopping_items")
          .select("id, list_id, name, note")
          .or(toOrIlikeFilter(["name", "note"], query))
          .limit(limit),
        (rows) =>
          rows.map((row) => ({
            type: "shopping_item" as const,
            id: asId(row.id),
            title: asText(row.name),
            snippet: snippetOf(asText(row.note)),
            href: "/lists",
          })),
      ),
    );
  }

  if (wanted(type, "event")) {
    jobs.push(
      collect(
        client
          .from("events")
          .select("id, title, description, location")
          .or(toOrIlikeFilter(["title", "description", "location"], query))
          .limit(limit),
        (rows) =>
          rows.map((row) => ({
            type: "event" as const,
            id: asId(row.id),
            title: asText(row.title),
            snippet: snippetOf(asText(row.description), asText(row.location)),
            href: "/calendar",
          })),
      ),
    );
  }

  if (wanted(type, "finance")) {
    jobs.push(
      collect(
        client
          .from("finance_records")
          .select("id, title, category, note")
          .or(toOrIlikeFilter(["title", "category", "note"], query))
          .limit(limit),
        (rows) =>
          rows.map((row) => ({
            type: "finance" as const,
            id: asId(row.id),
            title: asText(row.title),
            snippet: snippetOf(asText(row.category), asText(row.note)),
            href: "/finance",
          })),
      ),
    );
  }

  const groups = await Promise.all(jobs);
  return mergeSearchResults(query, groups.flat()).slice(0, SEARCH_RESULT_LIMIT);
}
