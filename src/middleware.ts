import { NextRequest, NextResponse } from "next/server";
import { verifyTokenEdge } from "@/lib/jwt-edge";

const ADMIN_COOKIE_NAME = "angren_admin_token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Check if path starts with /admin or /api/admin
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next();
  }

  // 2. Allow access to login page & login API
  const isLoginPage = pathname === "/admin/login";
  const isLoginApi = pathname === "/api/admin/auth/login";

  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  let isTokenValid = false;

  if (token) {
    const result = await verifyTokenEdge(token);
    isTokenValid = result.valid;
  }

  // 3. If user is already authenticated and visits /admin/login -> redirect to /admin
  if (isLoginPage) {
    if (isTokenValid) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // Allow login API without token
  if (isLoginApi) {
    return NextResponse.next();
  }

  // 4. Deny access if token is invalid or missing
  if (!isTokenValid) {
    // For API routes -> 401 Unauthorized JSON
    if (isAdminApi) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Access denied. Valid administrator credentials required.",
        },
        { status: 401 }
      );
    }

    // For web page routes -> Redirect to /admin/login
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Authorized admin session -> proceed
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
