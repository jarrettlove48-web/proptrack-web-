import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const intendedRole = searchParams.get("role"); // "tenant" or "landlord"

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        // Existing user with a role — redirect based on their actual role
        if (profile?.role === "tenant") {
          return NextResponse.redirect(`${origin}/tenant`);
        }
        if (profile?.role === "landlord") {
          return NextResponse.redirect(`${origin}/dashboard`);
        }

        // New user (no role set yet) — set role based on which tab they signed in from
        if (!profile?.role && intendedRole) {
          await supabase
            .from("profiles")
            .update({
              role: intendedRole,
              name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split("@")[0],
            })
            .eq("id", user.id);

          if (intendedRole === "tenant") {
            // New tenant via Google — send to invite page to enter their code
            return NextResponse.redirect(`${origin}/invite`);
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to auth page
  return NextResponse.redirect(`${origin}/auth?error=auth_callback_failed`);
}
