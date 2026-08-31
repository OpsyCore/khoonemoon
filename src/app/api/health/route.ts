import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("profiles").select("id").limit(1);

    if (error) {
      return Response.json(
        {
          ok: false,
          service: "supabase",
        },
        {
          status: 503,
        },
      );
    }

    return Response.json({
      ok: true,
      service: "supabase",
    });
  } catch {
    return Response.json(
      {
        ok: false,
        service: "supabase",
      },
      {
        status: 503,
      },
    );
  }
}
