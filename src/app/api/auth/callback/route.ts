import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getAuthCallbackErrorCode } from "@/features/auth/error-messages";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/today";

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth/login?error=auth_callback_missing_code", request.url),
    );
  }

  const { url, anonKey } = getSupabaseEnv();

  const response = NextResponse.redirect(new URL(next, request.url));

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const errorCode = getAuthCallbackErrorCode(error);
    return NextResponse.redirect(
      new URL(`/auth/login?error=${errorCode}`, request.url),
    );
  }

  return response;
}
