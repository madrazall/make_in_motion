import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";

/** Everything under /admin requires a valid session, except the login page. */
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

  if (pathname === "/admin/login") return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
