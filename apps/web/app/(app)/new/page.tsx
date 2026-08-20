import { Suspense } from "react";

import { requireTourWorkspace } from "@/lib/tour-auth";
import { getGoogleBusiness } from "@/lib/google-places";
import { NewSessionFlow } from "./NewSessionFlow";

export default async function NewSessionPage() {
  const workspace = await requireTourWorkspace();
  const propertyPhone = workspace.community.gmbId
    ? await getGoogleBusiness(workspace.community.gmbId).then((business) => business.phone).catch(() => null)
    : null;

  return (
    <Suspense fallback={null}>
      <NewSessionFlow
        propertyLocation={workspace.community.name}
        propertyId={workspace.community.propertyTygId}
        propertyPhone={propertyPhone}
        profileName={workspace.user.fullName ?? workspace.teamMember.name ?? workspace.user.email}
      />
    </Suspense>
  );
}
