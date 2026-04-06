import { cookies } from "next/headers";
import { AUTH_SESSION_COOKIE_NAME } from "@/lib/auth-constants";

export type SessionUser = {
  userId: string;
  username: string;
  name: string;
  role: string;
};

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(AUTH_SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionUser;
    if (!parsed?.userId || !parsed?.username) return null;
    return parsed;
  } catch {
    return null;
  }
}
