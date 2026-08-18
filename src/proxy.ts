import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = [
  "/today",
  "/calendar",
  "/home",
  "/lists",
  "/profile",
  "/settings",
  "/search",
];

const GUEST_ONLY_AUTH_PREFIXES = [
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isGuestOnlyAuthPath(pathname: string) {
  return GUEST_ONLY_AUTH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const { response, user } = await updateSupabaseSession(request);

  if (isProtectedPath(pathname) && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isGuestOnlyAuthPath(pathname) && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/today";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/today/:path*",
    "/calendar/:path*",
    "/home/:path*",
    "/lists/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/search/:path*",
    "/auth/:path*",
  ],
};
