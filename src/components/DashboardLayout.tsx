import { UserButton, useUser } from "@clerk/clerk-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Trophy, TrendingUp, Calendar, Shield, ClipboardList, Plus, Eye } from "lucide-react";
import { cn } from "../lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCoachProfile } from "../hooks/useCoachProfile";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const { isAdmin, isManager } = useCoachProfile();
  const [showFab, setShowFab] = useState(false);

  // Sync user to Supabase
  useEffect(() => {
    async function syncUser() {
      if (user) {
        // Upsert user but DO NOT overwrite role if it exists
        // We use onConflict to update only non-sensitive fields
        const { error } = await supabase.from('coaches').upsert({
          id: user.id,
          first_name: user.firstName,
          last_name: user.lastName,
          email: user.primaryEmailAddress?.emailAddress,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' }); // This might overwrite role if we don't handle it carefully. 
        // Actually Supabase upsert will overwrite columns provided. If role is not provided, it should be fine IF role is nullable or has default.
        // My migration set default 'coach'.
        
        if (error) console.error("Error syncing user:", error);
      }
    }
    syncUser();
  }, [user]);

  if (!isLoaded) return <div className="flex items-center justify-center h-screen">加载中...</div>;

  useEffect(() => {
    let title = "金海豚游泳俱乐部";
    if (location.pathname.startsWith("/plans")) title += " - 训练计划";
    else if (location.pathname.includes("/log")) title += " - 录入记录";
    else if (location.pathname.startsWith("/athletes")) title += " - 运动员";
    else if (location.pathname.startsWith("/insights")) title += " - 训练心得";
    else if (location.pathname.startsWith("/ranking")) title += " - 排行";
    else if (location.pathname.startsWith("/roles")) title += " - 权限管理";
    document.title = title;
  }, [location]);

  const navItems = [
    { href: "/plans", label: "训练计划", icon: Calendar },
    // { href: "/daily", label: "日常管理", icon: ClipboardList }, // Removed
    { href: "/athletes", label: "运动员", icon: Users },
    // { href: "/insights", label: "训练心得", icon: TrendingUp }, // Removed
    { href: "/ranking", label: "排行", icon: Trophy },
  ];

  if (isAdmin || isManager) {
    // navItems.push({ href: "/coaches", label: "教练管理", icon: Users }); // Removed
    navItems.push({ href: "/supervision", label: "监管控制台", icon: Eye });
  }

  if (isAdmin) {
    navItems.push({ href: "/roles", label: "权限管理", icon: Shield });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation - Desktop & Mobile Header */}
      <header className="bg-dolphin-blue border-b border-blue-900 sticky top-0 z-10 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center gap-3 group">
              <img src="/logo.jpg" alt="金海豚游泳俱乐部" className="h-10 w-auto object-contain" />
              <div className="flex flex-col">
                <span className="text-xl font-bold text-white leading-none">金海豚游泳俱乐部</span>
                <span className="text-xs text-dolphin-gold font-medium tracking-wider">KING DOLPHIN</span>
              </div>
            </Link>
            <nav className="ml-10 hidden md:flex space-x-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-blue-900/50 text-dolphin-gold border border-blue-700/50 shadow-sm"
                        : "text-blue-100 hover:bg-blue-800/50 hover:text-white"
                    )}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-blue-200 hidden md:inline-block">
                {user?.lastName}{user?.firstName}
            </span>
            <div className="bg-white/10 rounded-full p-1 hover:bg-white/20 transition-colors">
               <UserButton afterSignOutUrl="/" appearance={{
                  elements: {
                    avatarBox: "h-8 w-8"
                  }
               }}/>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-2 sm:px-6 lg:px-8 py-4 md:py-8 pb-24 md:pb-8 overflow-x-hidden">
        {children}
      </main>

      {/* Bottom Navigation - Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1",
                  isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-900"
                )}
              >
                <Icon className={cn("w-6 h-6", isActive && "fill-current")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-40">
        <div className="relative">
            {showFab && (
                <div className="absolute bottom-14 right-0 flex flex-col gap-2 mb-2 animate-in slide-in-from-bottom-5 fade-in duration-200">
                    <button 
                        onClick={() => { setShowFab(false); navigate('/athletes?action=quick_entry'); }}
                        className="flex items-center justify-end gap-2 text-white"
                    >
                        <span className="bg-gray-800 text-xs px-2 py-1 rounded shadow">录入成绩 (Ctrl+E)</span>
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition-colors">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                    </button>
                    {/* Removed Task Publish FAB */}
                </div>
            )}
            <button
                onClick={() => setShowFab(!showFab)}
                className={cn(
                    "w-12 h-12 md:w-14 md:h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300",
                    showFab ? "bg-gray-600 rotate-45" : "bg-blue-600 hover:bg-blue-700"
                )}
            >
                <Plus className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </button>
        </div>
      </div>
    </div>
  );
}
