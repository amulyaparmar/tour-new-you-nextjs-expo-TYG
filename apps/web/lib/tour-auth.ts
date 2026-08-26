import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  AdminAuthError,
  requireAdminContext,
} from "./admin-auth";

export async function requireTourWorkspace() {
  const requestHeaders = await headers();
  const request = new Request("http://tour.local", {
    headers: requestHeaders,
  });
  try {
    return await requireAdminContext(request);
  } catch (caught) {
    if (caught instanceof AdminAuthError) {
      if (caught.status === 401) {
        redirect(`/api/admin/auth/refresh-web?next=${encodeURIComponent(currentPath(requestHeaders))}`);
      }
      redirect("/login");
    }
    throw caught;
  }
}

/** Read the signed-in workspace without redirecting when a public page is requested. */
export async function getTourWorkspace() {
  const requestHeaders = await headers();
  const request = new Request("http://tour.local", { headers: requestHeaders });
  try {
    return await requireAdminContext(request);
  } catch (caught) {
    if (caught instanceof AdminAuthError && caught.status === 401) return null;
    throw caught;
  }
}

function currentPath(requestHeaders: Headers) {
  const forwardedPath =
    requestHeaders.get("x-tour-pathname") ??
    requestHeaders.get("x-next-url") ??
    requestHeaders.get("next-url") ??
    requestHeaders.get("x-matched-path");
  if (forwardedPath?.startsWith("/") && !forwardedPath.startsWith("//")) {
    return forwardedPath;
  }
  return "/";
}
