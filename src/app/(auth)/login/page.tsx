"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/actions/user";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await login(username, password);
      if (res.error) {
        setError(res.error);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "登录失败，请稍后再试";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/40 via-zinc-950 to-zinc-950" />
      <Card className="relative z-10 w-full max-w-md border-zinc-700 bg-zinc-900 text-zinc-100 shadow-2xl">
        <CardHeader className="space-y-1 border-b border-zinc-800 pb-4">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded border border-amber-500/40 bg-amber-500/10">
            <span className="font-mono text-lg font-bold text-amber-500">
              USS
            </span>
          </div>
          <CardTitle className="text-center text-lg tracking-tight">
            治具管理系统
          </CardTitle>
          <CardDescription className="text-center text-zinc-500">
            内网身份校验 · 请使用分配的账号登录
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-zinc-400">
                账号
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
                placeholder="工号或用户名"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-400">
                密码
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
                placeholder="••••••••"
              />
            </div>
            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-4 border-t border-zinc-800 pt-6">
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-600 text-zinc-950 hover:bg-amber-500"
            >
              {loading ? "登录中…" : "登录"}
            </Button>
            <p className="text-center text-xs text-zinc-600">
              默认管理员 admin / 123456
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
