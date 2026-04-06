"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { format } from "date-fns";
import { EditUserDialog } from "@/components/users/edit-user-dialog";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createUser, deleteUser } from "@/lib/actions/user";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  id: string;
  username: string;
  name: string;
  role: Role;
  createdAt: Date;
};

const roleLabels: Record<Role, string> = {
  ADMIN: "管理员",
  BOSS: "领导",
  PURCHASER: "采购",
  ENGINEER: "工程师",
};

export function UsersClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: Row[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("ENGINEER");
  const [, startTransition] = useTransition();

  const [editingUser, setEditingUser] = useState<Row | null>(null);

  function handleCreate() {
    startTransition(async () => {
      try {
        await createUser({ username, password, name, role });
        toast.success("用户已创建");
        setOpen(false);
        setUsername("");
        setPassword("");
        setName("");
        setRole("ENGINEER");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "创建失败");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("确定删除该用户？")) return;
    startTransition(async () => {
      try {
        await deleteUser(id);
        toast.success("已删除");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">账号权限管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            维护登录账号、角色与访问范围（仅管理员）
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          添加用户
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>账号</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialUsers.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono">{u.username}</TableCell>
                <TableCell>{u.name}</TableCell>
                <TableCell>{roleLabels[u.role]}</TableCell>
                <TableCell className="text-slate-500 text-sm">
                  {format(new Date(u.createdAt), "yyyy-MM-dd HH:mm")}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditingUser(u)}
                      aria-label="编辑用户"
                    >
                      <Edit2 className="h-4 w-4 text-slate-600" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={u.id === currentUserId}
                      onClick={() => handleDelete(u.id)}
                      aria-label="删除用户"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加用户</DialogTitle>
            <DialogDescription>
              新用户可使用所填账号密码登录系统。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="nu-username">账号</Label>
              <Input
                id="nu-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nu-password">密码</Label>
              <Input
                id="nu-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nu-name">真实姓名</Label>
              <Input
                id="nu-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>角色</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as Role)}
              >
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={handleCreate}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <EditUserDialog
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        user={editingUser}
      />
    </>
  );
}
