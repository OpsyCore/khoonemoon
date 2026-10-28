import { NextResponse } from "next/server";
import { getSessionContext, serverError } from "@/lib/api/session";

export async function GET(request: Request) {
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase } = session.context;
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const { data, error } = await supabase.rpc("search_workspace", {
    p_query: query,
    p_limit: 30,
  });

  if (error) return serverError("جستجو ناموفق بود.");

  return NextResponse.json({ results: data ?? [] });
}
