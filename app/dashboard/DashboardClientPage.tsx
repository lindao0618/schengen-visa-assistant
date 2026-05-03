"use client"

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import {
  Bot,
  UserCircle,
  FileText,
  Wallet,
  Bell,
  Settings,
  Sparkles,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProCard } from "@/components/pro-ui/pro-card";
import { ProShell } from "@/components/pro-ui/pro-shell";
import { ProStatus } from "@/components/pro-ui/pro-status";

// Define an interface for the module structure
interface Module {
  id: string;
  name: string;
  icon: React.ElementType;
  component: React.ComponentType;
}

type DashboardAiModelOption = {
  id: string;
  label: string;
  quality?: "fast" | "balanced" | "reasoning";
}

type DashboardAiPrefs = {
  defaultModel: string;
  deepAnalysisEnabled: boolean;
  answerStyle: "concise" | "detailed" | "table-first" | "action-card-first";
  outputFormat: "markdown" | "wechat-copy";
  pinnedShortcuts: string[];
}

const dashboardFallbackAiModels: DashboardAiModelOption[] = [
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", quality: "fast" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", quality: "reasoning" },
];

const dashboardDefaultAiPrefs: DashboardAiPrefs = {
  defaultModel: "deepseek-v4-flash",
  deepAnalysisEnabled: false,
  answerStyle: "action-card-first",
  outputFormat: "wechat-copy",
  pinnedShortcuts: ["查缺漏", "生成催办话术", "启动自动化"],
};

function ModuleLoadingCard({ title = "模块" }: { title?: string }) {
  return (
    <ProCard className="w-full p-6">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <p className="mt-3 text-sm text-white/45">正在加载模块数据...</p>
    </ProCard>
  );
}

const VisaServicesModule = dynamic(
  () => import("./components/visa-services").then((mod) => mod.VisaServicesModule),
  {
    ssr: false,
    loading: () => <ModuleLoadingCard title="我的签证服务" />,
  },
);

const UserProfileModule: React.FC = () => {
  const { data: session, status, update } = useSession();
  const [name, setName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordChangeMessage, setPasswordChangeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name);
    }
  }, [session?.user?.name]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleSaveName = async () => {
    if (!name.trim() || name.trim() === session?.user?.name) {
      setIsEditingName(false);
      setMessage(null); // Clear any previous messages if no change
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update name');
      }
      
      // Update the session using the `update` function from `useSession`
      // This ensures the UI reflects the change immediately without needing a page reload
      await update({ name: name.trim() });
      
      setMessage({ type: 'success', text: '名称更新成功！' });
      setIsEditingName(false);
    } catch (error: any) {
      console.error("Failed to update name:", error);
      setMessage({ type: 'error', text: error.message || '名称更新失败，请稍后再试。' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordChangeMessage(null);
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeMessage({ type: 'error', text: '新密码和确认密码不匹配。' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordChangeMessage({ type: 'error', text: '新密码长度至少为6位。' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '密码更新失败。');
      }
      setPasswordChangeMessage({ type: 'success', text: data.message || '密码更新成功！' });
      setShowChangePasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error: any) {
      setPasswordChangeMessage({ type: 'error', text: error.message || '密码更新失败，请稍后再试。' });
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <Card className="w-full border-white/10 bg-white/[0.04] text-white shadow-xl backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-white">用户资料</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-white/55">正在加载用户信息...</p>
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card className="w-full border-white/10 bg-white/[0.04] text-white shadow-xl backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-white">用户资料</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-white/55">请先登录以查看您的用户资料。</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border-white/10 bg-white/[0.04] text-white shadow-xl backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-white">用户资料</CardTitle>
        <CardDescription className="text-white/45">查看和编辑您的个人信息。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {message && (
          <div className={`p-3 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
            {message.text}
          </div>
        )}
        
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-white/65">邮箱地址</Label>
          <Input
            id="email"
            type="email"
            value={session.user?.email || ""}
            disabled
            className="pro-input cursor-not-allowed rounded-lg border-white/10 bg-white/[0.05] text-white/50"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium text-white/65">用户名称</Label>
          <div className="flex items-center space-x-3">
            <Input
              id="name"
              type="text"
              value={name}
              onChange={handleNameChange}
              disabled={!isEditingName || isLoading}
              className={`pro-input flex-grow rounded-lg border-white/10 ${!isEditingName ? 'bg-white/[0.05] text-white/60 cursor-default' : 'bg-white/[0.08] text-white'}`}
            />
            {!isEditingName ? (
              <Button variant="outline" onClick={() => { setIsEditingName(true); setMessage(null); }} className="shrink-0 rounded-lg border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white">
                编辑
              </Button>
            ) : (
              <div className="flex items-center space-x-2 shrink-0">
                <Button onClick={handleSaveName} disabled={isLoading || !name.trim() || name.trim() === session.user?.name} className="rounded-lg bg-white text-black hover:bg-zinc-200">
                  {isLoading ? "保存中..." : "保存"}
                </Button>
                <Button variant="ghost" onClick={() => { setIsEditingName(false); setName(session.user?.name || ""); setMessage(null); }} disabled={isLoading} className="rounded-lg text-white/55 hover:bg-white/[0.06] hover:text-white">
                  取消
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 border-t border-white/10 pt-6">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <h3 className="text-lg font-semibold text-white">修改密码</h3>
              {!showChangePasswordForm && (
                <Button 
                  variant="outline" 
                  className="rounded-lg border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white"
                  onClick={() => { setShowChangePasswordForm(true); setPasswordChangeMessage(null); }}
                >
                  修改密码
                </Button>
              )}
            </div>
            {showChangePasswordForm ? (
              <form onSubmit={handleChangePassword} className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                {passwordChangeMessage && (
                  <div className={`p-3 rounded-md text-sm font-medium ${passwordChangeMessage.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                    {passwordChangeMessage.text}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="currentPassword" className="text-white/65">当前密码</Label>
                  <Input 
                    type="password" 
                    id="currentPassword" 
                    value={currentPassword} 
                    onChange={(e) => setCurrentPassword(e.target.value)} 
                    required 
                    className="pro-input rounded-lg border-white/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-white/65">新密码</Label>
                  <Input 
                    type="password" 
                    id="newPassword" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    required 
                    className="pro-input rounded-lg border-white/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmNewPassword" className="text-white/65">确认新密码</Label>
                  <Input 
                    type="password" 
                    id="confirmNewPassword" 
                    value={confirmNewPassword} 
                    onChange={(e) => setConfirmNewPassword(e.target.value)} 
                    required 
                    className="pro-input rounded-lg border-white/10"
                  />
                </div>
                <div className="flex space-x-3">
                  <Button type="submit" disabled={isLoading} className="rounded-lg bg-white text-black hover:bg-zinc-200">
                    {isLoading ? '提交中...' : '确认修改密码'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setShowChangePasswordForm(false); setPasswordChangeMessage(null); setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');}} disabled={isLoading} className="rounded-lg text-white/55 hover:bg-white/[0.06] hover:text-white">
                    取消
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-white/45">为确保账户安全，建议定期修改密码。</p>
            )}
          </div>
          <div className="border-t border-white/10 pt-6">
            <h3 className="mb-1.5 text-lg font-semibold text-white">头像上传</h3>
            <p className="mb-2.5 text-sm text-white/45">个性化您的账户，上传喜欢的头像。</p>
            <Button variant="outline" className="rounded-lg border-white/10 bg-white/[0.04] text-white/45 hover:bg-white/[0.08]" disabled> 
              上传头像 (暂不可用)
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const DocumentRepositoryModule: React.FC = () => (
  <ProCard className="w-full p-6">
    <h2 className="text-2xl font-bold text-white">我的文档库</h2>
    <p className="mt-2 text-sm leading-6 text-white/45">管理您的签证申请相关文件。</p>
    <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.04] p-5 text-sm text-white/50">
      文档库内容将在这里展示...
    </div>
  </ProCard>
);

const MembershipCenterModule: React.FC = () => (
  <ProCard className="w-full p-6">
    <h2 className="text-2xl font-bold text-white">会员中心</h2>
    <p className="mt-2 text-sm leading-6 text-white/45">查看您的会员状态、权益并管理您的会员计划。</p>
    <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.04] p-5 text-sm text-white/50">
      会员中心内容将在这里展示...
    </div>
  </ProCard>
);

const WalletTopUpModule: React.FC = () => (
  <ProCard className="w-full p-6">
    <h2 className="text-2xl font-bold text-white">钱包/充值中心</h2>
    <p className="mt-2 text-sm leading-6 text-white/45">管理您的账户余额、充值并查看交易记录。</p>
    <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.04] p-5 text-sm text-white/50">
      钱包/充值中心内容将在这里展示...
    </div>
  </ProCard>
);

const NotificationsModule: React.FC = () => (
  <ProCard className="w-full p-6">
    <h2 className="text-2xl font-bold text-white">通知中心</h2>
    <p className="mt-2 text-sm leading-6 text-white/45">查看您的重要提醒和消息。</p>
    <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.04] p-5 text-sm text-white/50">
      通知中心内容将在这里展示...
    </div>
  </ProCard>
);

function normalizeDashboardAiModels(value: unknown) {
  if (!Array.isArray(value)) return dashboardFallbackAiModels;
  const models = value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const source = item as Record<string, unknown>;
      const id = typeof source.id === "string" ? source.id.trim() : "";
      if (!id) return null;
      return {
        id,
        label: typeof source.label === "string" && source.label.trim() ? source.label.trim() : id,
        quality: source.quality === "balanced" || source.quality === "reasoning" ? source.quality : "fast",
      } as DashboardAiModelOption;
    })
    .filter((item): item is DashboardAiModelOption => Boolean(item));
  return models.length ? models : dashboardFallbackAiModels;
}

function normalizeDashboardAiPrefs(value: unknown): DashboardAiPrefs {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const answerStyle =
    source.answerStyle === "concise" ||
    source.answerStyle === "detailed" ||
    source.answerStyle === "table-first"
      ? source.answerStyle
      : "action-card-first";
  const outputFormat = source.outputFormat === "markdown" ? "markdown" : "wechat-copy";
  const pinnedShortcuts = Array.isArray(source.pinnedShortcuts)
    ? source.pinnedShortcuts
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
        .slice(0, 8)
    : dashboardDefaultAiPrefs.pinnedShortcuts;

  return {
    defaultModel: typeof source.defaultModel === "string" && source.defaultModel.trim()
      ? source.defaultModel.trim()
      : dashboardDefaultAiPrefs.defaultModel,
    deepAnalysisEnabled: typeof source.deepAnalysisEnabled === "boolean" ? source.deepAnalysisEnabled : false,
    answerStyle,
    outputFormat,
    pinnedShortcuts,
  };
}

const OpsAgentAiPreferencePanel: React.FC = () => {
  const [models, setModels] = useState<DashboardAiModelOption[]>(dashboardFallbackAiModels);
  const [prefs, setPrefs] = useState<DashboardAiPrefs>(dashboardDefaultAiPrefs);
  const [shortcutText, setShortcutText] = useState(dashboardDefaultAiPrefs.pinnedShortcuts.join("\n"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/ops-agent/settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("读取 AI 设置失败");
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const nextModels = normalizeDashboardAiModels(data?.effective?.availableModels);
        const nextPrefs = normalizeDashboardAiPrefs(data?.prefs || data?.effective);
        setModels(nextModels);
        setPrefs(nextPrefs);
        setShortcutText(nextPrefs.pinnedShortcuts.join("\n"));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setModels(dashboardFallbackAiModels);
        setPrefs(dashboardDefaultAiPrefs);
        setShortcutText(dashboardDefaultAiPrefs.pinnedShortcuts.join("\n"));
        setMessage({ type: "error", text: error instanceof Error ? error.message : "读取 AI 设置失败" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    const pinnedShortcuts = shortcutText
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
    const payload = { ...prefs, pinnedShortcuts };

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/ops-agent/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "保存 AI 设置失败");
      }
      const data = await response.json().catch(() => ({}));
      const nextPrefs = normalizeDashboardAiPrefs(data?.prefs || payload);
      setPrefs(nextPrefs);
      setShortcutText(nextPrefs.pinnedShortcuts.join("\n"));
      setMessage({ type: "success", text: "AI 设置已保存" });
    } catch (error: unknown) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "保存 AI 设置失败" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.045] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold text-white">
            <Bot className="h-5 w-5 text-cyan-200" />
            AI 设置
          </div>
          <p className="mt-2 text-sm leading-6 text-white/55">
            设置 Visa Ops Agent 的默认模型、深度分析和快捷指令。服务密钥由服务器环境变量统一读取，DeepSeek API Key 不在网页保存。
          </p>
        </div>
        <span className="w-fit rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
          deepseek-v4-flash
        </span>
      </div>

      {message ? (
        <div className={`mt-4 rounded-xl px-3 py-2 text-sm ${message.type === "success" ? "border border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border border-amber-300/20 bg-amber-300/10 text-amber-100"}`}>
          {message.text}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="block text-sm font-medium text-white/70">默认模型</span>
          <select
            value={prefs.defaultModel}
            onChange={(event) => setPrefs((current) => ({ ...current, defaultModel: event.target.value }))}
            className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-medium text-white outline-none focus:border-cyan-200/40"
          >
            {models.map((model) => (
              <option key={model.id} value={model.id} className="bg-slate-950 text-white">
                {model.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="block text-sm font-medium text-white/70">回复风格</span>
          <select
            value={prefs.answerStyle}
            onChange={(event) => setPrefs((current) => ({ ...current, answerStyle: event.target.value as DashboardAiPrefs["answerStyle"] }))}
            className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-medium text-white outline-none focus:border-cyan-200/40"
          >
            <option value="action-card-first" className="bg-slate-950 text-white">操作卡优先</option>
            <option value="table-first" className="bg-slate-950 text-white">表格优先</option>
            <option value="concise" className="bg-slate-950 text-white">简洁</option>
            <option value="detailed" className="bg-slate-950 text-white">详细</option>
          </select>
        </label>

        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 lg:col-span-2">
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4 text-cyan-200" />
              深度分析
            </span>
            <span className="mt-1 block text-xs leading-5 text-white/45">材料排查和失败诊断优先使用推理模型。</span>
          </span>
          <input
            type="checkbox"
            checked={prefs.deepAnalysisEnabled}
            onChange={(event) => setPrefs((current) => ({ ...current, deepAnalysisEnabled: event.target.checked }))}
            className="h-5 w-5 accent-cyan-200"
          />
        </label>

        <label className="space-y-2 lg:col-span-2">
          <span className="block text-sm font-medium text-white/70">快捷指令</span>
          <textarea
            value={shortcutText}
            onChange={(event) => setShortcutText(event.target.value)}
            className="min-h-28 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-200/40"
          />
        </label>
      </div>

      <Button onClick={handleSave} disabled={saving || loading} className="mt-5 rounded-xl bg-cyan-200 text-slate-950 hover:bg-cyan-100">
        {saving ? "保存中..." : "保存 AI 设置"}
      </Button>
    </section>
  );
};

const AccountSettingsModule: React.FC = () => (
  <ProCard className="w-full p-6">
    <h2 className="text-2xl font-bold text-white">账户设置</h2>
    <p className="mt-2 text-sm leading-6 text-white/45">管理您的账户偏好和安全设置。</p>
    <OpsAgentAiPreferencePanel />
    <Button variant="outline" className="mt-6 rounded-lg border-white/10 bg-white/[0.04] text-white/70 hover:bg-red-400/10 hover:text-red-200">
      退出登录
    </Button>
  </ProCard>
);

const AiSettingsModule: React.FC = () => (
  <div className="w-full">
    <OpsAgentAiPreferencePanel />
  </div>
);

export default function DashboardClientPage() {
  const [activeModule, setActiveModule] = useState<string>("visa-services"); // 默认显示签证服务模块

  const modules: Module[] = [
    { id: "user-profile", name: "用户资料", icon: UserCircle, component: UserProfileModule },
    { id: "visa-services", name: "我的签证服务", icon: FileText, component: VisaServicesModule },
    { id: "wallet-topup", name: "钱包/充值", icon: Wallet, component: WalletTopUpModule },
    { id: "notifications", name: "通知中心", icon: Bell, component: NotificationsModule },
    { id: "ai-settings", name: "AI 设置", icon: Bot, component: AiSettingsModule },
    { id: "account-settings", name: "账户设置", icon: Settings, component: AccountSettingsModule },
  ];

  const ActiveModuleComponent = modules.find(module => module.id === activeModule)?.component || (() => <p>模块加载失败。</p>);

  return (
    <ProShell innerClassName="pt-44">
      <div className="mb-8 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <ProCard className="p-5">
          <div className="mb-6">
            <ProStatus tone="info">Command Rail</ProStatus>
            <h2 className="mt-4 text-2xl font-bold text-white">个人中心</h2>
            <p className="mt-2 text-sm leading-6 text-white/42">统一管理账户、任务和签证自动化流程。</p>
          </div>
          <nav className="pro-module-nav space-y-2">
            {modules.map((module) => (
              <Button
                key={module.id}
                variant="ghost"
                className={`w-full justify-start rounded-2xl px-4 py-5 text-left text-sm transition-all duration-150 ease-in-out ${
                  activeModule === module.id
                    ? "border border-white/15 bg-white text-black shadow-[0_16px_40px_rgba(255,255,255,0.12)] hover:bg-zinc-200 hover:text-black"
                    : "border border-transparent text-white/58 hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
                }`}
                onClick={() => setActiveModule(module.id)}
              >
                <module.icon className="mr-3 h-5 w-5 shrink-0" />
                <span className="truncate">{module.name}</span>
              </Button>
            ))}
          </nav>
          <div className="mt-6 border-t border-white/10 pt-4">
            <Button
              variant="ghost"
              className="w-full justify-start rounded-2xl px-4 py-5 text-left text-sm text-white/45 hover:bg-red-400/10 hover:text-red-200"
            >
              <LogOut className="mr-3 h-5 w-5 shrink-0" />
              <span className="truncate">退出登录</span>
            </Button>
          </div>
        </ProCard>

        <main className="space-y-6">
          <ProCard className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <ProStatus tone="online">Workspace Overview</ProStatus>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">VISTORIA 618 PRO 工作台</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/45">
                  跟踪签证任务、材料审核、预约监控和账户状态，所有操作从这里进入。
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  ["Tasks", "04"],
                  ["Alerts", "02"],
                  ["Sync", "Live"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-lg font-bold text-white">{value}</div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </ProCard>
          <ActiveModuleComponent />
        </main>
      </div>
    </ProShell>
  );
}
