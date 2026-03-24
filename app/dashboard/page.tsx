"use client"

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  UserCircle,
  FileText,
  FolderKanban,
  Award,
  Wallet,
  Bell,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VisaServicesModule } from "./components/visa-services";

// Define an interface for the module structure
interface Module {
  id: string;
  name: string;
  icon: React.ElementType;
  component: React.FC;
}

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
      <Card className="w-full bg-white/70 backdrop-blur-md shadow-xl rounded-xl border border-gray-200/50">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-800">用户资料</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">正在加载用户信息...</p>
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card className="w-full bg-white/70 backdrop-blur-md shadow-xl rounded-xl border border-gray-200/50">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-800">用户资料</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">请先登录以查看您的用户资料。</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-white/70 backdrop-blur-md shadow-xl rounded-xl border border-gray-200/50">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-gray-800">用户资料</CardTitle>
        <CardDescription className="text-gray-600">查看和编辑您的个人信息。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {message && (
          <div className={`p-3 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
            {message.text}
          </div>
        )}
        
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-gray-700">邮箱地址</Label>
          <Input
            id="email"
            type="email"
            value={session.user?.email || ""}
            disabled
            className="bg-gray-100/70 border-gray-300/70 rounded-lg text-gray-700 cursor-not-allowed"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium text-gray-700">用户名称</Label>
          <div className="flex items-center space-x-3">
            <Input
              id="name"
              type="text"
              value={name}
              onChange={handleNameChange}
              disabled={!isEditingName || isLoading}
              className={`border-gray-300/90 rounded-lg flex-grow ${!isEditingName ? 'bg-gray-100/70 text-gray-700 cursor-default' : 'text-gray-900'}`}
            />
            {!isEditingName ? (
              <Button variant="outline" onClick={() => { setIsEditingName(true); setMessage(null); }} className="rounded-lg border-gray-300/90 text-gray-700 hover:bg-gray-100/70 shrink-0">
                编辑
              </Button>
            ) : (
              <div className="flex items-center space-x-2 shrink-0">
                <Button onClick={handleSaveName} disabled={isLoading || !name.trim() || name.trim() === session.user?.name} className="bg-black text-white hover:bg-gray-800 rounded-lg">
                  {isLoading ? "保存中..." : "保存"}
                </Button>
                <Button variant="ghost" onClick={() => { setIsEditingName(false); setName(session.user?.name || ""); setMessage(null); }} disabled={isLoading} className="rounded-lg text-gray-600 hover:bg-gray-100/70">
                  取消
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200/80 space-y-6">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <h3 className="text-lg font-semibold text-gray-800">修改密码</h3>
              {!showChangePasswordForm && (
                <Button 
                  variant="outline" 
                  className="rounded-lg border-gray-300/90 text-gray-700 hover:bg-gray-100/70 text-sm py-1.5 px-3"
                  onClick={() => { setShowChangePasswordForm(true); setPasswordChangeMessage(null); }}
                >
                  修改密码
                </Button>
              )}
            </div>
            {showChangePasswordForm ? (
              <form onSubmit={handleChangePassword} className="space-y-4 mt-4 p-4 border border-gray-200/90 rounded-lg bg-white/50">
                {passwordChangeMessage && (
                  <div className={`p-3 rounded-md text-sm font-medium ${passwordChangeMessage.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                    {passwordChangeMessage.text}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="currentPassword">当前密码</Label>
                  <Input 
                    type="password" 
                    id="currentPassword" 
                    value={currentPassword} 
                    onChange={(e) => setCurrentPassword(e.target.value)} 
                    required 
                    className="border-gray-300/90 rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">新密码</Label>
                  <Input 
                    type="password" 
                    id="newPassword" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    required 
                    className="border-gray-300/90 rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmNewPassword">确认新密码</Label>
                  <Input 
                    type="password" 
                    id="confirmNewPassword" 
                    value={confirmNewPassword} 
                    onChange={(e) => setConfirmNewPassword(e.target.value)} 
                    required 
                    className="border-gray-300/90 rounded-lg"
                  />
                </div>
                <div className="flex space-x-3">
                  <Button type="submit" disabled={isLoading} className="bg-black text-white hover:bg-gray-800 rounded-lg">
                    {isLoading ? '提交中...' : '确认修改密码'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setShowChangePasswordForm(false); setPasswordChangeMessage(null); setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');}} disabled={isLoading} className="rounded-lg text-gray-600 hover:bg-gray-100/70">
                    取消
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-gray-600">为确保账户安全，建议定期修改密码。</p>
            )}
          </div>
          <div className="pt-6 border-t border-gray-200/80">
            <h3 className="text-lg font-semibold text-gray-800 mb-1.5">头像上传</h3>
            <p className="text-sm text-gray-600 mb-2.5">个性化您的账户，上传喜欢的头像。</p>
            <Button variant="outline" className="rounded-lg border-gray-300/90 text-gray-700 hover:bg-gray-100/70" disabled> 
              上传头像 (暂不可用)
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const DocumentRepositoryModule: React.FC = () => (
  <Card className="w-full bg-white/70 backdrop-blur-md shadow-xl rounded-xl border border-gray-200/50">
    <CardHeader>
      <CardTitle className="text-2xl font-bold text-gray-800">我的文档库</CardTitle>
      <CardDescription className="text-gray-600">管理您的签证申请相关文件。</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-gray-700">文档库内容将在这里展示...</p>
      {/* TODO: File upload, list, view, delete, categorize, tag features */}
    </CardContent>
  </Card>
);

const MembershipCenterModule: React.FC = () => (
  <Card className="w-full bg-white/70 backdrop-blur-md shadow-xl rounded-xl border border-gray-200/50">
    <CardHeader>
      <CardTitle className="text-2xl font-bold text-gray-800">会员中心</CardTitle>
      <CardDescription className="text-gray-600">查看您的会员状态、权益并管理您的会员计划。</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-gray-700">会员中心内容将在这里展示...</p>
      {/* TODO: Membership status, benefits, upgrade/renew options, access to exclusive content */}
    </CardContent>
  </Card>
);

const WalletTopUpModule: React.FC = () => (
  <Card className="w-full bg-white/70 backdrop-blur-md shadow-xl rounded-xl border border-gray-200/50">
    <CardHeader>
      <CardTitle className="text-2xl font-bold text-gray-800">钱包/充值中心</CardTitle>
      <CardDescription className="text-gray-600">管理您的账户余额、充值并查看交易记录。</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-gray-700">钱包/充值中心内容将在这里展示...</p>
      {/* TODO: Account balance, top-up options (payment integration needed), transaction history */}
    </CardContent>
  </Card>
);

const NotificationsModule: React.FC = () => (
  <Card className="w-full bg-white/70 backdrop-blur-md shadow-xl rounded-xl border border-gray-200/50">
    <CardHeader>
      <CardTitle className="text-2xl font-bold text-gray-800">通知中心</CardTitle>
      <CardDescription className="text-gray-600">查看您的重要提醒和消息。</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-gray-700">通知中心内容将在这里展示...</p>
      {/* TODO: List of notifications: important alerts, application progress, system messages */}
    </CardContent>
  </Card>
);

const AccountSettingsModule: React.FC = () => (
  <Card className="w-full bg-white/70 backdrop-blur-md shadow-xl rounded-xl border border-gray-200/50">
    <CardHeader>
      <CardTitle className="text-2xl font-bold text-gray-800">账户设置</CardTitle>
      <CardDescription className="text-gray-600">管理您的账户偏好和安全设置。</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-gray-700">账户设置内容将在这里展示...</p>
      {/* TODO: Notification preferences, security settings (2FA), privacy settings, logout/delete account */}
      <Button variant="outline" className="mt-6 border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400 rounded-lg">
        退出登录
      </Button>
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  const [activeModule, setActiveModule] = useState<string>("visa-services"); // 默认显示签证服务模块

  const modules: Module[] = [
    { id: "user-profile", name: "用户资料", icon: UserCircle, component: UserProfileModule },
    { id: "visa-services", name: "我的签证服务", icon: FileText, component: VisaServicesModule },
    { id: "wallet-topup", name: "钱包/充值", icon: Wallet, component: WalletTopUpModule },
    { id: "notifications", name: "通知中心", icon: Bell, component: NotificationsModule },
    { id: "account-settings", name: "账户设置", icon: Settings, component: AccountSettingsModule },
  ];

  const ActiveModuleComponent = modules.find(module => module.id === activeModule)?.component || (() => <p>模块加载失败。</p>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 text-gray-900 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 bg-white/80 backdrop-blur-md p-4 md:p-6 shadow-lg space-y-4 border-b md:border-b-0 md:border-r border-gray-200/80 shrink-0">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-6 text-center md:text-left">个人中心</h2>
        <nav className="space-y-1.5">
          {modules.map((module) => (
            <Button
              key={module.id}
              variant="ghost" // Base variant is ghost for custom styling
              className={`w-full justify-start text-left px-4 py-2.5 text-sm md:text-base rounded-lg transition-all duration-150 ease-in-out ${ 
                activeModule === module.id
                  ? "bg-black text-white shadow-md hover:bg-gray-800"
                  : "text-gray-700 hover:bg-gray-100 hover:text-black"
              }`}
              onClick={() => setActiveModule(module.id)}
            >
              <module.icon className="mr-3 h-5 w-5 shrink-0" />
              <span className="truncate">{module.name}</span>
            </Button>
          ))}
        </nav>
        <div className="pt-4 mt-auto border-t border-gray-200/60">
           <Button
              variant="ghost"
              className="w-full justify-start text-left px-4 py-2.5 text-sm md:text-base text-gray-600 hover:bg-gray-100 hover:text-red-600 rounded-lg transition-all duration-150 ease-in-out"
              // onClick={handleLogout} // TODO: Add logout functionality later
            >
              <LogOut className="mr-3 h-5 w-5 shrink-0" />
              <span className="truncate">退出登录</span>
            </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 overflow-auto">
        <ActiveModuleComponent />
      </main>
    </div>
  );
}