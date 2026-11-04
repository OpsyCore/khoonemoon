"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Search } from "../../../../mobile/src/search";
import type { SearchKind } from "../filters";

const routes: Record<SearchKind, string> = {
  task: "/today?manage=1#task-list",
  event: "/calendar",
  shopping_item: "/lists",
  finance: "/finance",
  chore: "/today?manage=1#chore-list",
};
export function SearchReference({ userId }: { userId: string }) {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  return (
    <Search
      client={client}
      userId={userId}
      persistUrl={false}
      onNavigate={(kind) => router.push(routes[kind])}
    />
  );
}
