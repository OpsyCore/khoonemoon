"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Assistant } from "../../../../mobile/src/assistant";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MobilePage } from "../../../../mobile/src/navigation";

const routes: Partial<Record<MobilePage, string>> = {
  shopping: "/lists",
  calendar: "/calendar",
  tasks: "/today",
  meals: "/meals",
  bills: "/bills",
  documents: "/documents",
  settings: "/settings",
};

export function AssistantReference() {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  return (
    <Assistant
      client={client}
      onNavigate={(page) => {
        const route = routes[page];
        if (route) router.push(route);
      }}
    />
  );
}
