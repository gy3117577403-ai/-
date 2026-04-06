import { getSession } from "@/lib/auth";
import SidebarClient from "./sidebar-client";
import { getSettings } from "@/lib/actions/settings";

export default async function Sidebar() {
  const session = await getSession();
  const settings = await getSettings();
  return <SidebarClient session={session} systemName={settings.systemName} />;
}
