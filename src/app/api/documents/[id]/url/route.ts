import { NextResponse } from "next/server";
import {
  DOCUMENT_BUCKET,
  DOCUMENT_SELECT,
  DOCUMENT_SIGNED_URL_SECONDS,
} from "@/features/documents/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const { data: document, error } = await supabase
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !document) {
    return NextResponse.json({ message: "مدرک یافت نشد." }, { status: 404 });
  }

  const signed = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(document.storage_path, DOCUMENT_SIGNED_URL_SECONDS);

  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json(
      { message: "ساخت لینک مشاهده ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    url: signed.data.signedUrl,
    expiresIn: DOCUMENT_SIGNED_URL_SECONDS,
  });
}
