import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";

/**
 * Everything under /admin requires a valid session, except the login pages.
 *
 * The "content" role only ever gets past this gate for /admin/content/* — it
 * exists so the content calendar can be handed to someone else without
 * giving them the guest lists, revenue, or delete buttons that live under
 * every other /admin path. "admin" role passes everywhere, content included.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Demo mode has no database and no real data to protect, so the admin is
  // open for review.
  //
  // The NODE_ENV check matters: without it, a deploy that's missing its
  // Supabase secret would fall into demo mode AND publish an unauthenticated
  // /admin to the open internet. Locally that's convenient; in production it
  // must never happen, so production always requires the password.
  if (isDemoMode() && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  if (pathname === "/admin/login" || pathname === "/admin/content/login") {
    return NextResponse.next();
  }

  const isContentPath = pathname.startsWith("/admin/content");
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const role = await verifySessionToken(token);

  if (role === "admin") return NextResponse.next();
  if (role === "content" && isContentPath) return NextResponse.next();

  // A content-role session hitting a path it can't reach is still logged in —
  // just not here. Send it home instead of to a login screen it can't use.
  if (role === "content") {
    return NextResponse.redirect(new URL("/admin/content", req.url));
  }

  const url = req.nextUrl.clone();
  url.pathname = isContentPath ? "/admin/content/login" : "/admin/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
