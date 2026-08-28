import { NextResponse } from "next/server";
import { createDocumentMetaSchema } from "@/features/documents/schemas";
import {
  buildStoragePath,
  documentErrorStatus,
  getCurrentDocumentMembership,
  mapDocumentError,
  validateCreateDocumentForUser,
} from "@/features/documents/server";
import {
  DOCUMENT_BUCKET,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  DOCUMENT_SELECT,
  type DocumentRecord,
} from "@/features/documents/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const membership = await getCurrentDocumentMembership(user.id);
    const { data, error } = await supabase
      .from("documents")
      .select(DOCUMENT_SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { message: "دریافت مدارک ناموفق بود." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      documents: (data ?? []) as DocumentRecord[],
      householdId: membership?.household_id ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { message: mapDocumentError(error) },
      { status: documentErrorStatus(error) },
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { message: "درخواست فایل معتبر نیست." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: "فایل الزامی است." },
      { status: 400 },
    );
  }

  const parsed = createDocumentMetaSchema.safeParse({
    title: form.get("title"),
    description: form.get("description") || null,
    visibility: form.get("visibility"),
    mimeType: file.type,
    fileSize: file.size,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "اطلاعات مدرک معتبر نیست.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (
    !(DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type) ||
    file.size > DOCUMENT_MAX_BYTES
  ) {
    return NextResponse.json(
      { message: "نوع یا حجم فایل معتبر نیست." },
      { status: 400 },
    );
  }

  const documentId = crypto.randomUUID();

  try {
    const prepared = await validateCreateDocumentForUser({
      userId: user.id,
      visibility: parsed.data.visibility,
    });

    const storagePath = buildStoragePath({
      visibility: parsed.data.visibility,
      userId: user.id,
      householdId: prepared.householdId,
      documentId,
      fileName: file.name,
    });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const upload = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(storagePath, bytes, {
        contentType: parsed.data.mimeType,
        upsert: false,
      });

    if (upload.error) {
      return NextResponse.json(
        { message: "بارگذاری فایل ناموفق بود." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("documents")
      .insert({
        id: documentId,
        household_id: prepared.householdId,
        created_by: user.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        mime_type: parsed.data.mimeType,
        file_size: parsed.data.fileSize,
        storage_path: storagePath,
        visibility: parsed.data.visibility,
      })
      .select("id")
      .single();

    if (error || !data) {
      await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
      return NextResponse.json(
        { message: "ثبت مدرک ناموفق بود." },
        { status: 400 },
      );
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: mapDocumentError(error) },
      { status: documentErrorStatus(error) },
    );
  }
}
