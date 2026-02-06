import { UserButton, useUser } from "@clerk/clerk-react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { LayoutDashboard, Users, Activity, Swords, Users2, Settings, Plus, ClipboardList, Timer, Zap } from "lucide-react";
import { cn } from "../lib/utils";
import { useState } from "react";

export default function NationalLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const [showFab, setShowFab] = useState(false);

  if (!isLoaded) return <div className="flex items-center justify-center h-screen bg-brand-dark text-white">加载中...</div>;

  const navItems = [
    { href: "/national/tasks", label: "任务指挥台", icon: LayoutDashboard },
    { href: "/national/athletes", label: "全息档案", icon: Users },
    { href: "/national/plans", label: "智能训练", icon: Activity },
    { href: "/national/war-room", label: "赛事作战室", icon: Swords },
    { href: "/national/team", label: "团队协作", icon: Users2 },
    { href: "/national/automation", label: "自动化配置", icon: Zap },
    { href: "/national/tools", label: "系统工具", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-brand-blue text-white h-screen sticky top-0 border-r border-blue-800 shadow-xl z-20">
        <div className="h-16 flex items-center px-6 border-b border-blue-800 bg-brand-dark/20">
            <img src="/logo.jpg" alt="Logo" className="h-8 w-8 rounded-full border border-brand-gold mr-3" />
            <div>
                <span className="font-bold text-lg tracking-wide block">国家队管理</span>
                <span className="text-[10px] text-brand-gold uppercase tracking-wider">National Team</span>
            </div>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1">
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.href);
                return (
                    <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                            "flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                            isActive 
                                ? "bg-white/10 text-brand-gold shadow-lg" 
                                : "text-blue-200 hover:bg-white/5 hover:text-white"
                        )}
                    >
                        {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-gold"></div>}
                        <Icon className={cn("w-5 h-5 mr-3 transition-transform group-hover:scale-110", isActive && "text-brand-gold")} />
                        {item.label}
                    </Link>
                );
            })}
        </nav>

        <div className="p-4 border-t border-blue-800 bg-brand-dark/10">
            <div className="flex items-center gap-3">
                <div className="bg-brand-gold/20 p-1 rounded-full">
                    <UserButton afterSignOutUrl="/" appearance={{
                        elements: { avatarBox: "w-8 h-8 ring-2 ring-brand-gold/50" }
                    }}/>
                </div>
                <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium truncate">{user?.fullName || user?.primaryEmailAddress?.emailAddress}</span>
                    <span className="text-xs text-blue-300">主教练</span>
                </div>
            </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden bg-brand-blue text-white p-4 flex justify-between items-center sticky top-0 z-20 shadow-md">
         <div className="flex items-center gap-2">
            <img src="/logo.jpg" alt="Logo" className="h-8 w-8 rounded-full border border-brand-gold" />
            <span className="font-bold">国家队管理</span>
         </div>
         <UserButton afterSignOutUrl="/" />
      </div>

      {/* Main Content */}
      <main className="flex-1 w-full overflow-x-hidden relative">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 pb-24 md:pb-8">
            <Outlet />
         </div>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1",
                  isActive ? "text-brand-blue" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "fill-current/20")} />
                <span className="text-[10px] font-medium scale-90">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-40">
        <div className="relative">
            {showFab && (
                <div className="absolute bottom-14 right-0 flex flex-col gap-3 mb-2 animate-in slide-in-from-bottom-5 fade-in duration-200 min-w-[140px]">
                    <button 
                        onClick={() => { setShowFab(false); navigate('/national/plans?action=new'); }}
                        className="flex items-center justify-end gap-2 group"
                    >
                        <span className="bg-gray-800 text-white text-xs px-2 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">新建计划</span>
                        <div className="w-10 h-10 bg-brand-gold rounded-full flex items-center justify-center shadow-lg hover:brightness-110 transition-all text-brand-blue">
                            <Activity className="w-5 h-5" />
                        </div>
                    </button>
                    <button 
                        onClick={() => { setShowFab(false); navigate('/national/tasks?action=new'); }}
                        className="flex items-center justify-end gap-2 group"
                    >
                        <span className="bg-gray-800 text-white text-xs px-2 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">发布任务</span>
                        <div className="w-10 h-10 bg-brand-blue rounded-full flex items-center justify-center shadow-lg hover:brightness-110 transition-all text-white">
                            <ClipboardList className="w-5 h-5" />
                        </div>
                    </button>
                </div>
            )}
            <button
                onClick={() => setShowFab(!showFab)}
                className={cn(
                    "w-12 h-12 md:w-14 md:h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ring-4 ring-white/50",
                    showFab ? "bg-gray-600 rotate-45" : "bg-gradient-to-br from-brand-blue to-brand-dark hover:scale-105"
                )}
            >
                <Plus className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </button>
        </div>
      </div>
    </div>
  );
}
