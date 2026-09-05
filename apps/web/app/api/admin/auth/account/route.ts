import { NextResponse } from "next/server";

import {
  ADMIN_COMMUNITY_COOKIE,
  ADMIN_REFRESH_COOKIE,
  AdminAuthError,
  deleteAdminAccessCookies,
  requireAdminContext,
} from "@/lib/admin-auth";
import { removePropertyTeamIdentity } from "@/lib/property-team";
import { getSupabaseServiceClient } from "@/lib/supabase";

export async function DELETE(request: Request) {
  try {
    const workspace = await requireAdminContext(request);
    const userId = workspace.user.id;
    const email = workspace.user.email.trim().toLowerCase();
    const supabase = getSupabaseServiceClient();

    await removePropertyTeamIdentity({ userId, email });

    await supabase.from("device_push_tokens").delete().eq("user_id", userId);

    // Legacy profile table — ignore if it is gone or already empty.
    await supabase.from("user_profiles").delete().eq("user_id", userId);

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      throw new Error(deleteError.message || "Could not delete this account.");
    }

    const response = NextResponse.json({ ok: true });
    deleteAdminAccessCookies(response);
    response.cookies.delete(ADMIN_REFRESH_COOKIE);
    response.cookies.delete(ADMIN_COMMUNITY_COOKIE);
    return response;
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Could not delete your account." },
      { status: caught instanceof AdminAuthError ? caught.status : 500 },
    );
  }
}
