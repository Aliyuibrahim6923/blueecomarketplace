import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv, publicEnvIssues } from "@/lib/env";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding"];

/**
 * Refreshes the Supabase auth cookie on every request and redirects signed-out
 * visitors away from protected pages. This is a UX convenience only — data is
 * protected by RLS, not by this redirect.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Misconfigured deployment: let the request through so the app can show a
  // setup message instead of a bare 500 from the middleware.
  if (publicEnvIssues().length > 0) return response;
  const { supabaseUrl, supabaseKey } = publicEnv();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Do not run code between createServerClient and getUser(): it refreshes the token.
  let user = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch {
    // Supabase unreachable: carry on as signed-out rather than failing the request.
  }

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  return response;
}
