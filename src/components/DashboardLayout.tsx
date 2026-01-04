import { UserButton, useUser } from "@clerk/clerk-react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Trophy, TrendingUp } from "lucide-react";
import { cn } from "../lib/utils";
import { useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, isLoaded } = useUser();

  // Sync user to Supabase
  useEffect(() => {
    async function syncUser() {
      if (user) {
        const { error } = await supabase.from('coaches').upsert({
          id: user.id,
          first_name: user.firstName,
          last_name: user.lastName,
          email: user.primaryEmailAddress?.emailAddress,
          updated_at: new Date().toISOString()
        });
        if (error) console.error("Error syncing user:", error);
      }
    }
    syncUser();
  }, [user]);

  if (!isLoaded) return <div className="flex items-center justify-center h-screen">加载中...</div>;

  useEffect(() => {
    let title = "金海豚游泳俱乐部";
    if (location.pathname.startsWith("/dashboard")) title += " - 仪表盘";
    else if (location.pathname.includes("/log")) title += " - 录入记录";
    else if (location.pathname.startsWith("/athletes")) title += " - 运动员";
    else if (location.pathname.startsWith("/insights")) title += " - 训练心得";
    else if (location.pathname.startsWith("/ranking")) title += " - 排行";
    document.title = title;
  }, [location]);

  const navItems = [
    { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
    { href: "/athletes", label: "运动员", icon: Users },
    { href: "/insights", label: "训练心得", icon: TrendingUp },
    { href: "/ranking", label: "排行", icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation - Desktop */}
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-24 md:pb-8">
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
    </div>
  );
}
