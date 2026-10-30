import { NextResponse } from "next/server";
import { createDocumentAttachmentSchema } from "@/features/documents/schemas";
import { entityExistsForUser } from "@/features/documents/server";
import { DOCUMENT_SELECT } from "@/features/documents/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "درخواست JSON معتبر نیست." },
      { status: 400 },
    );
  }

  const parsed = createDocumentAttachmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "اطلاعات پیوست معتبر نیست.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const accessible = await entityExistsForUser(
    parsed.data.entityType,
    parsed.data.entityId,
  );
  if (!accessible) {
    return NextResponse.json(
      { message: "مورد مقصد یافت نشد." },
      { status: 404 },
    );
  }

  const { data, error } = await supabase
    .from("document_attachments")
    .insert({
      document_id: id,
      entity_type: parsed.data.entityType,
      entity_id: parsed.data.entityId,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { message: "ثبت پیوست ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
