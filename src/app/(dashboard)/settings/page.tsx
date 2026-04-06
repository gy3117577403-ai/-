import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/actions/settings";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await getSession();
  if (session?.role !== "ADMIN") {
    redirect("/");
  }

  const initialSettings = await getSettings();

  return <SettingsClient initialSettings={initialSettings} />;
}
