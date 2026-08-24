import "server-only";

import type { AdminCommunity } from "./admin-auth";

export type TeamAgent = {
  id: string;
  name: string;
  fullName: string;
  authUserId: string | null;
  email: string;
};

export async function listTeamAgents(communities: AdminCommunity[]): Promise<TeamAgent[]> {
  const byEmail = new Map<string, TeamAgent>();

  for (const community of communities) {
    for (const member of community.teamMembers) {
      if (!member.email || byEmail.has(member.email)) continue;
      byEmail.set(member.email, {
        id: member.alias || member.id || member.email,
        name: member.name,
        fullName: member.name,
        authUserId: member.userId ?? null,
        email: member.email,
      });
    }
  }

  return [...byEmail.values()].sort((left, right) =>
    left.fullName.localeCompare(right.fullName, undefined, { sensitivity: "base" })
  );
}
