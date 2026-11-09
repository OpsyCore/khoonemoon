"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Meals } from "../../../mobile/src/meals";
export function MealsReference({
  householdId,
}: {
  householdId: string | null;
}) {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  return (
    <Meals
      client={client}
      householdId={householdId}
      onShopping={() => router.push("/lists")}
      onHouse={() => router.push("/home")}
    />
  );
}
