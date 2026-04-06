"use client";

import { useState, useTransition } from "react";
import { updateSettings } from "@/lib/actions/settings";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface SettingsClientProps {
  initialSettings: {
    systemName: string;
    announcement: string;
    enableConfetti: string;
  };
}

export function SettingsClient({ initialSettings }: SettingsClientProps) {
  const [systemName, setSystemName] = useState(initialSettings.systemName);
  const [announcement, setAnnouncement] = useState(initialSettings.announcement);
  const [enableConfetti, setEnableConfetti] = useState(
    initialSettings.enableConfetti === "true"
  );
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await updateSettings({
          systemName,
          announcement,
          enableConfetti: enableConfetti ? "true" : "false",
        });
        toast.success("系统设置已保存，并在全站生效");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">系统设置</h1>
        <p className="mt-1 text-sm text-slate-500">
          管理系统基础配置、功能开关与全局公告
        </p>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">系统品牌设置</CardTitle>
          <CardDescription>
            修改左侧边栏顶部的系统名称。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="systemName">系统名称</Label>
            <Input
              id="systemName"
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              placeholder="例如: 治具与物资管理系统"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">全厂大喇叭</CardTitle>
          <CardDescription>
            在所有页面的顶部横幅展示全局公告。留空即可关闭公告。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="announcement">公告内容</Label>
            <textarea
              id="announcement"
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="今天下午停电 / 新版入库流程已上线..."
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">赛博撒花模式 🎊</CardTitle>
          <CardDescription>
            开启后，审批同意或物资入库时将触发全屏礼花特效。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative inline-block w-10 h-6">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={enableConfetti}
                onChange={(e) => setEnableConfetti(e.target.checked)}
              />
              <div className="h-6 w-10 rounded-full bg-slate-200 transition-colors peer-checked:bg-amber-500"></div>
              <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4"></div>
            </div>
            <span className="text-sm font-medium text-slate-700">
              {enableConfetti ? "已开启撒花" : "未开启撒花"}
            </span>
          </label>
        </CardContent>
        <CardFooter className="border-t border-slate-100 bg-slate-50 pt-6">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "保存中..." : "保存设置"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
