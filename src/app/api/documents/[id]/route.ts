import { NextResponse } from "next/server";
import { updateDocumentSchema } from "@/features/documents/schemas";
import { DOCUMENT_BUCKET, DOCUMENT_SELECT } from "@/features/documents/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getAccessibleDocument(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function GET(
  _request: Request,
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

  const document = await getAccessibleDocument(id);
  if (!document) {
    return NextResponse.json({ message: "مدرک یافت نشد." }, { status: 404 });
  }

  const { data: attachments, error } = await supabase
    .from("document_attachments")
    .select("id, document_id, entity_type, entity_id, created_by, created_at")
    .eq("document_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { message: "دریافت پیوست‌ها ناموفق بود." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    document,
    attachments: attachments ?? [],
  });
}

export async function PATCH(
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

  const existing = await getAccessibleDocument(id);
  if (!existing) {
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

  const parsed = updateDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "اطلاعات مدرک معتبر نیست.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const update: { title?: string; description?: string | null } = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.description !== undefined) {
    update.description = parsed.data.description;
  }

  const { data, error } = await supabase
    .from("documents")
    .update(update)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { message: "ویرایش مدرک ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
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

  const existing = await getAccessibleDocument(id);
  if (!existing) {
    return NextResponse.json({ message: "مدرک یافت نشد." }, { status: 404 });
  }

  const removed = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .remove([existing.storage_path]);

  if (removed.error) {
    return NextResponse.json(
      { message: "حذف فایل ذخیره‌شده ناموفق بود." },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { message: "حذف مدرک ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
