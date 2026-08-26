import { headers } from "next/headers";
import { getTourWorkspace } from "@/lib/tour-auth";
import { requireTourWorkspace } from "@/lib/tour-auth";
import { BottomNav } from "../BottomNav";
import { QueryProvider } from "../QueryProvider";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import "../globals.css";

export default async function AppLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-tour-pathname") ?? requestHeaders.get("x-next-url") ?? requestHeaders.get("x-matched-path") ?? "";
  const isPublicSessionDetail = /^\/sessions\/[^/]+$/.test(pathname) || pathname === "/sessions/[id]";
  const workspace = isPublicSessionDetail
    ? await getTourWorkspace()
    : await requireTourWorkspace();
  if (!workspace) return <>{children}</>;
  const currentCommunity = {
    id: workspace.community.id,
    name: workspace.community.name,
    alias: workspace.community.alias,
  };
  const communitySummaries = [
    currentCommunity,
    ...workspace.communities
      .filter((community) => community.id !== currentCommunity.id)
      .slice(0, 24)
      .map((community) => ({
        id: community.id,
        name: community.name,
        alias: community.alias,
      })),
  ];

  return (
    <QueryProvider>
      <div className="app-shell">
        <header className="top-bar">
          <img src="/images/tour logo TYG dark.svg" alt="Tour" height="28" style={{ height: 28, width: "auto" }} />
          <WorkspaceSwitcher
            user={workspace.user}
            currentCommunity={currentCommunity}
            communities={communitySummaries}
          />
        </header>
        <main className="main-content">{children}</main>
        <BottomNav />
      </div>
    </QueryProvider>
  );
}
