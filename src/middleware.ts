import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { allowedMenuKeysForRole, canAccessPath, firstAccessibleHref } from "./lib/menu-access";
import { supabaseAnonKey, supabaseUrl } from "./lib/supabase/env";
import type { Profile, ProfileMenuAccess } from "./lib/types";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>();
    if (profile) {
      const { data: accessRows, error: accessError } = await supabase
        .from("profile_menu_access")
        .select("*")
        .eq("profile_id", profile.id)
        .returns<ProfileMenuAccess[]>();
      const allowedMenuKeys = allowedMenuKeysForRole(profile.role, accessError ? [] : accessRows ?? []);

      if (!canAccessPath(request.nextUrl.pathname, profile.role, allowedMenuKeys)) {
        return NextResponse.redirect(new URL(firstAccessibleHref(profile.role, allowedMenuKeys), request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
