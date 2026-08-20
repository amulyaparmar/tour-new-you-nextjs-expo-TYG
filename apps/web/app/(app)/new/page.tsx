import { Suspense } from "react";

import { requireTourWorkspace } from "@/lib/tour-auth";
import { getGoogleBusiness } from "@/lib/google-places";
import { getPrimaryRubricForProperty, listRubricsForCommunity } from "@/lib/rubrics";
import { NewSessionFlow } from "./NewSessionFlow";

export default async function NewSessionPage() {
  const workspace = await requireTourWorkspace();
  const propertyPhone = workspace.community.gmbId
    ? await getGoogleBusiness(workspace.community.gmbId).then((business) => business.phone).catch(() => null)
    : null;
  const rubrics = await listRubricsForCommunity(workspace.community.propertyTygId);
  const phoneCallRubrics = rubrics.length > 0
    ? rubrics
    : [await getPrimaryRubricForProperty(workspace.community.propertyTygId)];

  return (
    <Suspense fallback={null}>
      <NewSessionFlow
        propertyLocation={workspace.community.name}
        propertyId={workspace.community.propertyTygId}
        propertyPhone={propertyPhone}
        profileName={workspace.user.fullName ?? workspace.teamMember.name ?? workspace.user.email}
        phoneCallRubrics={phoneCallRubrics.map(({ id, name, sessionType, isDefault }) => ({ id, name, sessionType, isDefault }))}
      />
    </Suspense>
  );
}
