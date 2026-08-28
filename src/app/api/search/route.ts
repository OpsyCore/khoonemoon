import { NextResponse } from "next/server";
import { parseSearchQuery } from "@/features/search/query";
import { searchAccessibleRecords } from "@/features/search/server";
import type { SearchResponse } from "@/features/search/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = parseSearchQuery({
    q: url.searchParams.get("q"),
    type: url.searchParams.get("type"),
  });

  if (!parsed.ok) {
    const message =
      parsed.code === "TOO_LONG"
        ? "عبارت جستجو خیلی بلند است."
        : "عبارت جستجو را وارد کنید.";
    return NextResponse.json({ message }, { status: 400 });
  }

  try {
    const results = await searchAccessibleRecords({
      client: supabase as unknown as Parameters<
        typeof searchAccessibleRecords
      >[0]["client"],
      query: parsed.query,
      type: parsed.type,
    });

    const body: SearchResponse = {
      query: parsed.query,
      results,
      total: results.length,
    };

    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { message: "جستجو ناموفق بود." },
      { status: 500 },
    );
  }
}
