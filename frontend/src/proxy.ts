import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie and gates every private page.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and auth.getClaims():
  // it can cause users to be randomly signed out.
  //
  // getClaims() verifies the session JWT locally against the project's
  // asymmetric signing key (cached JWKS) instead of calling the Supabase
  // Auth server on every page view, as auth.getUser() did.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const isSignInPage = request.nextUrl.pathname.startsWith("/sign-in");

  if (!user && !isSignInPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && isSignInPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Everything except static assets, the PWA manifest, public share pages,
    // and the media route — which enforces auth itself, so gating it here
    // would just add a second Supabase Auth round trip to every image.
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|share/|api/media/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
