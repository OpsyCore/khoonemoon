import { NextResponse } from "next/server";
import { DOCUMENT_SELECT } from "@/features/documents/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const { id, attachmentId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: document } = await supabase
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (!document) {
    return NextResponse.json({ message: "مدرک یافت نشد." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("document_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("document_id", id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ message: "پیوست یافت نشد." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
