import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUsers } from "@/lib/actions/user";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const session = await getSession();
  if (session?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const initialUsers = await getUsers();

  return (
    <UsersClient
      initialUsers={initialUsers}
      currentUserId={session.userId}
    />
  );
}
