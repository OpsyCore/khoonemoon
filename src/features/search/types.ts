export const SEARCH_ENTITY_TYPES = [
  "task",
  "chore",
  "shopping_list",
  "shopping_item",
  "event",
  "finance",
] as const;

export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];

export const SEARCH_TYPE_FILTERS = ["all", ...SEARCH_ENTITY_TYPES] as const;
export type SearchTypeFilter = (typeof SEARCH_TYPE_FILTERS)[number];

export type SearchResult = {
  type: SearchEntityType;
  id: string;
  title: string;
  snippet: string | null;
  href: string;
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
  total: number;
};

export const SEARCH_TYPE_LABELS: Record<SearchEntityType, string> = {
  task: "تسک",
  chore: "کار خانه",
  shopping_list: "لیست خرید",
  shopping_item: "کالای خرید",
  event: "رویداد",
  finance: "مالی",
};
