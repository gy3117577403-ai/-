"use client";

import { useEffect, useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { toast } from "sonner";
import { updateUser } from "@/lib/actions/user";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    username: string;
    name: string;
    role: Role;
  } | null;
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
}: EditUserDialogProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("ENGINEER");
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (user && open) {
      setName(user.name);
      setRole(user.role);
      setPassword(""); // 默认留空，留空代表不修改
    }
  }, [user, open]);

  function handleUpdate() {
    if (!user) return;
    startTransition(async () => {
      try {
        await updateUser(user.id, {
          name,
          role,
          password: password.trim() ? password : undefined,
        });
        toast.success("用户已更新");
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "更新失败");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑用户</DialogTitle>
          <DialogDescription>
            修改用户的信息和权限。如果不需要修改密码，请留空。
          </DialogDescription>
        </DialogHeader>
        {user && (
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>账号</Label>
              <Input value={user.username} disabled className="bg-slate-50" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="eu-name">真实姓名</Label>
              <Input
                id="eu-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="eu-password">密码 (选填)</Label>
              <Input
                id="eu-password"
                type="password"
                placeholder="留空代表不修改密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>角色</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">管理员</SelectItem>
                  <SelectItem value="BOSS">领导</SelectItem>
                  <SelectItem value="PURCHASER">采购</SelectItem>
                  <SelectItem value="ENGINEER">工程师</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button type="button" onClick={handleUpdate}>
            保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
