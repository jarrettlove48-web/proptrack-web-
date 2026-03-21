import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const role = searchParams.get("role"); // "landlord" or "tenant"
  const inviteCode = searchParams.get("invite_code"); // from tenant invite flow

  // Check query param first, fall back to cookie (OAuth redirects can strip query params)
  let contractorInviteCode = searchParams.get("contractor_invite_code");
  if (!contractorInviteCode) {
    const cookies = request.headers.get("cookie") || "";
    const match = cookies.match(/contractor_invite_code=([^;]+)/);
    if (match) contractorInviteCode = decodeURIComponent(match[1]);
  }

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

        // Contractor with invite code
        if (contractorInviteCode) {
          const { error: redeemErr } = await supabase.rpc("redeem_contractor_invite", {
            code: contractorInviteCode,
            uid: user.id,
          });

          if (!redeemErr) {
            // Explicitly set profile role to contractor (RPC may not do this)
            await supabase
              .from("profiles")
              .update({ role: "contractor" })
              .eq("id", user.id);

            const res = NextResponse.redirect(`${origin}/contractor`);
            res.cookies.set("contractor_invite_code", "", { path: "/", maxAge: 0 });
            return res;
          }

          return NextResponse.redirect(
            `${origin}/contractor-invite?error=${encodeURIComponent(redeemErr?.message || "Failed to redeem invite code")}`
          );
        }

        // Returning contractor
        if (profile?.role === "contractor") {
          return NextResponse.redirect(`${origin}/contractor`);
        }

        // Tenant with invite code — redeem it regardless of new/returning
        if (inviteCode) {
          // Set role to tenant (upsert — works for new and existing users)
          await supabase
            .from("profiles")
            .update({ role: "tenant" })
            .eq("id", user.id);

          // Redeem the invite code to link this user to their unit
          const { data: redeemData, error: redeemError } = await supabase.rpc(
            "redeem_invite",
            { code: inviteCode }
          );

          if (!redeemError && redeemData?.success) {
            return NextResponse.redirect(`${origin}/tenant`);
          }

          // Redemption failed — send to invite page with error
          return NextResponse.redirect(
            `${origin}/invite?error=${encodeURIComponent(
              redeemData?.error || redeemError?.message || "Failed to redeem invite code"
            )}`
          );
        }

        // Returning user with existing role (no invite code)
        if (profile?.role === "tenant") {
          return NextResponse.redirect(`${origin}/tenant`);
        }
        if (profile?.role === "landlord") {
          return NextResponse.redirect(`${origin}/dashboard`);
        }

        // New user, no invite code — assign based on which tab they signed in from
        if (role === "tenant") {
          await supabase
            .from("profiles")
            .update({ role: "tenant" })
            .eq("id", user.id);
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
