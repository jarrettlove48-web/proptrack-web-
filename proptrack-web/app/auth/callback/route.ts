import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const role = searchParams.get("role"); // "landlord" or "tenant"

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

        // Returning user with existing role
        if (profile?.role === "tenant") {
          return NextResponse.redirect(`${origin}/tenant`);
        }
        if (profile?.role === "landlord") {
          return NextResponse.redirect(`${origin}/dashboard`);
        }

        // New user (no role set yet) — assign based on which tab they signed in from
        if (role === "tenant") {
          await supabase
            .from("profiles")
            .update({ role: "tenant" })
            .eq("id", user.id);
          // Send to invite page so they can enter their invite code
          return NextResponse.redirect(`${origin}/invite`);
        }

        // Default: new landlord
        await supabase
          .from("profiles")
          .update({ role: "landlord" })
          .eq("id", user.id);
        return NextResponse.redirect(`${origin}/dashboard`);
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // Auth error — redirect to auth page
  return NextResponse.redirect(`${origin}/auth?error=auth_callback_failed`);
}
