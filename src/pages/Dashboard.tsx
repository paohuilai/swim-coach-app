import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "../lib/supabase";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, subYears } from "date-fns";
import { Calendar, Filter, Target, CheckCircle, Plus, Save, X, AlertCircle, Settings, Trash2, Pin, Users, Edit2 } from "lucide-react";
import { CoachTarget, CoachSignin, CoachCustomGroup, CoachPeriod } from "../types";

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  
  // --- States ---

  // Selection
  const [selectedGroup, setSelectedGroup] = useState<string>("all"); // "all", "year_2019", "group_uuid"
  const [timeRange, setTimeRange] = useState<string>("week"); // "week", "month", "year", "period_uuid", "custom"
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Data Lists
  const [birthYears, setBirthYears] = useState<number[]>([]);
  const [customGroups, setCustomGroups] = useState<CoachCustomGroup[]>([]);
  const [customPeriods, setCustomPeriods] = useState<CoachPeriod[]>([]);
  
  // Dashboard Data
  const [currentTarget, setCurrentTarget] = useState<CoachTarget | null>(null);
  const [signins, setSignins] = useState<CoachSignin[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showSigninModal, setShowSigninModal] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [showPeriodManager, setShowPeriodManager] = useState(false);
  
  // Forms
  const [targetForm, setTargetForm] = useState({ sessions: 6, km: 50 });
  const [signinForm, setSigninForm] = useState({ sessions: 1, km: 0, note: "", date: format(new Date(), "yyyy-MM-dd") });
  
  // Manager Forms
  const [groupForm, setGroupForm] = useState<{ name: string; years: number[]; isPinned: boolean }>({ name: "", years: [], isPinned: false });
  const [periodForm, setPeriodForm] = useState<{ name: string; start: string; end: string; isPinned: boolean }>({ name: "", start: "", end: "", isPinned: false });

  // --- Effects ---

  useEffect(() => {
    if (user) {
      fetchMeta();
    }
  }, [user]);

  // When group changes, fetch valid periods for this group
  useEffect(() => {
    if (user) {
        fetchPeriods();
        // Reset time range to default if current period is not valid for new group?
        // Ideally we keep 'week'/'month' etc, but if a specific period was selected, it might be invalid.
        // For simplicity, we can let the user switch manually or handle it in fetchPeriods logic.
    }
  }, [user, selectedGroup]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, selectedGroup, timeRange, customStartDate, customEndDate, customPeriods]); // Added customPeriods to dep to refresh when periods change

  // --- Data Fetching ---

  async function fetchMeta() {
    if (!user) return;
    
    // 1. Fetch Athletes for Birth Years
    const { data: athletes } = await supabase
      .from("athletes")
      .select("birth_year")
      .eq("coach_id", user.id);
      
    if (athletes) {
      const years = Array.from(new Set(athletes.map(a => a.birth_year).filter(Boolean) as number[])).sort((a,b) => b - a);
      setBirthYears(years);
    }

    // 2. Fetch Custom Groups
    fetchCustomGroups(true); // Enable auto-switch on load
  }

  async function fetchCustomGroups(autoSwitch: boolean = false) {
    if (!user) return;
    const { data } = await supabase
        .from("coach_custom_groups")
        .select("*")
        .eq("coach_id", user.id)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
    
    setCustomGroups(data || []);

    if (autoSwitch && data) {
        const pinned = data.find(g => g.is_pinned);
        if (pinned) {
            // If pinned exists, switch to it.
            // We do this if autoSwitch is true (initial load or manual toggle)
            setSelectedGroup(`group_${pinned.id}`);
        }
    }
  }

  async function fetchPeriods() {
    if (!user) return;
    
    let query = supabase
        .from("coach_periods")
        .select("*")
        .eq("coach_id", user.id);

    // Filter periods based on selected group
    if (selectedGroup.startsWith("group_")) {
        const groupId = selectedGroup.replace("group_", "");
        query = query.eq("custom_group_id", groupId);
    } else if (selectedGroup.startsWith("year_")) {
        const year = parseInt(selectedGroup.replace("year_", ""));
        query = query.eq("birth_year", year);
    } else {
        query = query.is("custom_group_id", null).is("birth_year", null); 
    }

    const { data } = await query.order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
    setCustomPeriods(data || []);

    // Auto-select pinned period
    const pinned = data?.find(p => p.is_pinned);
    if (pinned) {
        setTimeRange(pinned.id);
    } else {
        // If no pinned period found, and current timeRange is a period UUID (which might be from previous group), reset to week
        // Or if we want to enforce "week" as default when no pinned period exists
        setTimeRange("week");
    }
  }

  function getDateRange() {
    const now = new Date();
    let start = "";
    let end = "";

    // Check if timeRange is a period UUID
    const period = customPeriods.find(p => p.id === timeRange);

    if (period) {
        start = period.start_date;
        end = period.end_date;
    } else if (timeRange === 'custom') {
      start = customStartDate;
      end = customEndDate;
    } else {
      let startObj = now;
      let endObj = now;
      
      switch (timeRange) {
        case 'week':
            startObj = startOfWeek(now, { weekStartsOn: 1 });
            endObj = endOfWeek(now, { weekStartsOn: 1 });
            break;
        case 'month':
            startObj = startOfMonth(now);
            endObj = endOfMonth(now);
            break;
        case 'year':
            startObj = subYears(now, 1);
            break;
      }
      start = format(startObj, 'yyyy-MM-dd');
      end = format(endObj, 'yyyy-MM-dd');
    }
    return { start, end };
  }

  async function fetchData() {
    if (!user) return;
    setLoading(true);

    const { start, end } = getDateRange();
    if (!start || !end) {
        setLoading(false);
        return;
    }

    // Determine Context
    let birthYear = 0;
    let customGroupId: string | null = null;

    if (selectedGroup.startsWith("year_")) {
        birthYear = parseInt(selectedGroup.replace("year_", ""));
    } else if (selectedGroup.startsWith("group_")) {
        customGroupId = selectedGroup.replace("group_", "");
    }

    // 1. Fetch Target
    // Query based on context
    let targetQuery = supabase.from("coach_targets").select("*").eq("coach_id", user.id).eq("period_start", start).eq("period_end", end);
    
    if (customGroupId) {
        targetQuery = targetQuery.eq("custom_group_id", customGroupId);
    } else {
        targetQuery = targetQuery.eq("birth_year", birthYear).is("custom_group_id", null);
    }

    const { data: targetData } = await targetQuery.maybeSingle();

    setCurrentTarget(targetData);
    if (targetData) {
        setTargetForm({ sessions: targetData.target_sessions, km: targetData.target_km });
    } else {
        setTargetForm({ sessions: 6, km: 50 });
    }

    // 2. Fetch Signins
    // Strict isolation: only fetch signins that match the EXACT context (group_id or birth_year)
    let signinQuery = supabase.from("coach_signins").select("*").eq("coach_id", user.id).gte("signin_date", start).lte("signin_date", end);

    if (customGroupId) {
        signinQuery = signinQuery.eq("custom_group_id", customGroupId);
    } else {
        signinQuery = signinQuery.eq("birth_year", birthYear).is("custom_group_id", null);
    }

    const { data: signinData } = await signinQuery;
    setSignins(signinData || []);
    setLoading(false);
  }

  // --- Handlers ---

  async function handleSaveTarget() {
    if (!user) return;
    const { start, end } = getDateRange();
    
    let birthYear = 0;
    let customGroupId: string | null = null;
    if (selectedGroup.startsWith("year_")) {
        birthYear = parseInt(selectedGroup.replace("year_", ""));
    } else if (selectedGroup.startsWith("group_")) {
        customGroupId = selectedGroup.replace("group_", "");
    }

    const payload = {
        coach_id: user.id,
        birth_year: birthYear,
        custom_group_id: customGroupId,
        period_start: start,
        period_end: end,
        target_sessions: targetForm.sessions,
        target_km: targetForm.km,
    };

    if (currentTarget) {
        await supabase.from("coach_targets").update(payload).eq("id", currentTarget.id);
    } else {
        await supabase.from("coach_targets").insert(payload);
    }
    
    setShowTargetModal(false);
    fetchData();
  }

  async function handleSignin() {
    if (!user) return;
    
    let birthYear = 0;
    let customGroupId: string | null = null;
    if (selectedGroup.startsWith("year_")) {
        birthYear = parseInt(selectedGroup.replace("year_", ""));
    } else if (selectedGroup.startsWith("group_")) {
        customGroupId = selectedGroup.replace("group_", "");
    }

    const payload = {
        coach_id: user.id,
        birth_year: birthYear,
        custom_group_id: customGroupId,
        signin_date: signinForm.date,
        sessions: signinForm.sessions,
        km: signinForm.km,
        note: signinForm.note
    };

    await supabase.from("coach_signins").insert(payload);
    setShowSigninModal(false);
    setSigninForm({ ...signinForm, sessions: 1, km: 0, note: "" });
    fetchData();
  }

  // Group Management Handlers
  async function handleCreateGroup() {
    if (!user || !groupForm.name) return;

    // If pinning, unpin others first
    if (groupForm.isPinned) {
        await supabase.from("coach_custom_groups").update({ is_pinned: false }).eq("coach_id", user.id);
    }

    await supabase.from("coach_custom_groups").insert({
        coach_id: user.id,
        name: groupForm.name,
        birth_years: groupForm.years,
        is_pinned: groupForm.isPinned
    });
    setGroupForm({ name: "", years: [], isPinned: false });
    fetchCustomGroups(true); // Force refresh and re-check pins
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm("确定要删除这个组别吗？")) return;
    await supabase.from("coach_custom_groups").delete().eq("id", id);
    fetchCustomGroups(false);
    if (selectedGroup === `group_${id}`) setSelectedGroup("all");
  }

  async function toggleGroupPin(id: string, current: boolean) {
    if (!user) return;
    if (!current) {
        // Pinning this one -> Unpin all others first
        await supabase.from("coach_custom_groups").update({ is_pinned: false }).eq("coach_id", user.id);
    }
    await supabase.from("coach_custom_groups").update({ is_pinned: !current }).eq("id", id);
    fetchCustomGroups(true); // Force check to switch if needed
  }

  // Period Management Handlers
  async function handleCreatePeriod() {
    if (!user || !periodForm.name || !periodForm.start || !periodForm.end) return;
    
    let birthYear: number | null = null;
    let customGroupId: string | null = null;
    if (selectedGroup.startsWith("year_")) {
        birthYear = parseInt(selectedGroup.replace("year_", ""));
    } else if (selectedGroup.startsWith("group_")) {
        customGroupId = selectedGroup.replace("group_", "");
    }

    // If pinning, unpin others in this scope
    if (periodForm.isPinned) {
        let query = supabase.from("coach_periods").update({ is_pinned: false }).eq("coach_id", user.id);
        if (customGroupId) {
            query = query.eq("custom_group_id", customGroupId);
        } else if (birthYear) {
            query = query.eq("birth_year", birthYear);
        } else {
            query = query.is("custom_group_id", null).is("birth_year", null);
        }
        await query;
    }

    await supabase.from("coach_periods").insert({
        coach_id: user.id,
        name: periodForm.name,
        start_date: periodForm.start,
        end_date: periodForm.end,
        is_pinned: periodForm.isPinned,
        birth_year: birthYear,
        custom_group_id: customGroupId
    });
    
    setPeriodForm({ name: "", start: "", end: "", isPinned: false });
    fetchPeriods();
  }

  async function handleDeletePeriod(id: string) {
    if (!confirm("确定要删除这个周期吗？")) return;
    await supabase.from("coach_periods").delete().eq("id", id);
    fetchPeriods();
    if (timeRange === id) setTimeRange("week");
  }

  async function togglePeriodPin(id: string, current: boolean, period: CoachPeriod) {
    if (!user) return;
    if (!current) {
        // Pinning -> Unpin all others in same scope
        let query = supabase.from("coach_periods").update({ is_pinned: false }).eq("coach_id", user.id);
        if (period.custom_group_id) {
            query = query.eq("custom_group_id", period.custom_group_id);
        } else if (period.birth_year) {
            query = query.eq("birth_year", period.birth_year);
        } else {
            query = query.is("custom_group_id", null).is("birth_year", null);
        }
        await query;
    }
    await supabase.from("coach_periods").update({ is_pinned: !current }).eq("id", id);
    fetchPeriods();
  }

  // --- Calculations ---
  const totalSessions = signins.reduce((sum, s) => sum + s.sessions, 0);
  const totalKm = signins.reduce((sum, s) => sum + s.km, 0);
  const sessionProgress = currentTarget ? Math.min(100, Math.round((totalSessions / currentTarget.target_sessions) * 100)) : 0;
  const kmProgress = currentTarget ? Math.min(100, Math.round((totalKm / currentTarget.target_km) * 100)) : 0;

  if (!isLoaded) return <div className="flex justify-center p-8">加载中...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-dolphin-blue flex items-center">
                <Target className="w-6 h-6 mr-2 text-dolphin-gold" />
                目标与签到
            </h1>
            <p className="text-sm text-gray-500 mt-1">
                {user?.firstName}{user?.lastName}教练，今日也是充满干劲的一天！
            </p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center">
            {/* Group Selector */}
            <div className="flex items-center gap-2">
                <div className="flex items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                    <Users className="w-4 h-4 text-gray-400 mr-2" />
                    <select 
                        value={selectedGroup}
                        onChange={(e) => setSelectedGroup(e.target.value)}
                        className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer"
                    >
                        <option value="all">全部组别</option>
                        <optgroup label="出生年份">
                            {birthYears.map(y => (
                                <option key={y} value={`year_${y}`}>{y}年组</option>
                            ))}
                        </optgroup>
                        {customGroups.length > 0 && (
                            <optgroup label="自定义组">
                                {customGroups.map(g => (
                                    <option key={g.id} value={`group_${g.id}`}>
                                        {g.is_pinned ? '📌 ' : ''}{g.name}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                </div>
                <button onClick={() => setShowGroupManager(true)} className="p-2 text-gray-400 hover:text-dolphin-blue hover:bg-gray-50 rounded-lg" title="管理组别">
                    <Settings className="w-4 h-4" />
                </button>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center gap-2">
                <div className="flex items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                    <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                    <select 
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer max-w-[140px] truncate"
                    >
                        <option value="week">本周</option>
                        <option value="month">本月</option>
                        <option value="year">近一年</option>
                        {customPeriods.length > 0 && <option disabled>──────────</option>}
                        {customPeriods.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.is_pinned ? '📌 ' : ''}{p.name}
                            </option>
                        ))}
                        <option disabled>──────────</option>
                        <option value="custom">自定义日期</option>
                    </select>
                </div>
                <button onClick={() => setShowPeriodManager(true)} className="p-2 text-gray-400 hover:text-dolphin-blue hover:bg-gray-50 rounded-lg" title="管理周期">
                    <Settings className="w-4 h-4" />
                </button>
            </div>

            {timeRange === 'custom' && (
                <div className="flex items-center gap-2">
                    <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="text-sm border p-1 rounded" />
                    <span>-</span>
                    <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="text-sm border p-1 rounded" />
                </div>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Goal Card */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden relative">
            <div className="bg-dolphin-blue/5 p-4 border-b border-dolphin-blue/10 flex justify-between items-center">
                <h3 className="text-lg font-bold text-dolphin-blue flex items-center">
                    <Target className="w-5 h-5 mr-2" />
                    当前目标
                </h3>
                <button onClick={() => setShowTargetModal(true)} className="text-sm text-dolphin-blue hover:text-dolphin-dark font-medium underline">
                    {currentTarget ? "修改目标" : "设置目标"}
                </button>
            </div>
            
            <div className="p-8">
                {currentTarget ? (
                    <div className="grid grid-cols-2 gap-8 text-center">
                        <div>
                            <p className="text-gray-500 text-sm mb-1">目标场次</p>
                            <p className="text-4xl font-bold text-dolphin-blue">{currentTarget.target_sessions}<span className="text-lg text-gray-400 ml-1">场</span></p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-sm mb-1">目标里程</p>
                            <p className="text-4xl font-bold text-dolphin-gold">{currentTarget.target_km}<span className="text-lg text-gray-400 ml-1">km</span></p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 mb-4">当前时段暂无目标</p>
                        <button onClick={() => setShowTargetModal(true)} className="bg-dolphin-blue text-white px-6 py-2 rounded-lg hover:bg-dolphin-dark transition-colors">
                            立即设置
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* Check-in Card */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden flex flex-col">
            <div className="bg-dolphin-gold/5 p-4 border-b border-dolphin-gold/10 flex justify-between items-center">
                <h3 className="text-lg font-bold text-dolphin-dark flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2 text-dolphin-gold" />
                    进度打卡
                </h3>
                {currentTarget && (
                    <button onClick={() => setShowSigninModal(true)} className="bg-dolphin-gold text-white text-sm px-4 py-1.5 rounded-full hover:bg-yellow-500 transition-colors flex items-center shadow-sm">
                        <Plus className="w-4 h-4 mr-1" />
                        签到
                    </button>
                )}
            </div>
            
            <div className="p-8 flex-1 flex flex-col justify-center">
                {!currentTarget ? (
                    <p className="text-center text-gray-400">请先设置目标开启打卡</p>
                ) : (
                    <div className="space-y-8">
                        {/* Session Progress */}
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="font-medium text-gray-700">训练场次 ({totalSessions}/{currentTarget.target_sessions})</span>
                                <span className="text-dolphin-blue font-bold">{sessionProgress}%</span>
                            </div>
                            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-dolphin-blue rounded-full transition-all duration-1000 ease-out" style={{ width: `${sessionProgress}%` }} />
                            </div>
                            <p className="text-xs text-gray-400 mt-2 text-right">
                                {totalSessions >= currentTarget.target_sessions ? "目标达成！🎉" : `还差 ${currentTarget.target_sessions - totalSessions} 场`}
                            </p>
                        </div>

                        {/* KM Progress */}
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="font-medium text-gray-700">训练里程 ({totalKm}/{currentTarget.target_km}km)</span>
                                <span className="text-dolphin-gold font-bold">{kmProgress}%</span>
                            </div>
                            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-dolphin-gold rounded-full transition-all duration-1000 ease-out" style={{ width: `${kmProgress}%` }} />
                            </div>
                            <p className="text-xs text-gray-400 mt-2 text-right">
                                {totalKm >= currentTarget.target_km ? "里程达标！💪" : `还差 ${(currentTarget.target_km - totalKm).toFixed(1)} km`}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* 1. Target Modal */}
      {showTargetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800">设置目标</h3>
                    <button onClick={() => setShowTargetModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <div className="space-y-4">
                    <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 mb-4">
                        当前范围：{timeRange === 'week' ? '本周' : timeRange === 'month' ? '本月' : timeRange === 'year' ? '近一年' : timeRange === 'custom' ? '自定义时段' : customPeriods.find(p => p.id === timeRange)?.name} <br/>
                        针对组别：{selectedGroup === 'all' ? '全部组别' : selectedGroup.startsWith('year_') ? `${selectedGroup.replace('year_', '')}年组` : customGroups.find(g => `group_${g.id}` === selectedGroup)?.name}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">目标场次</label>
                            <input type="number" value={targetForm.sessions} onChange={e => setTargetForm({...targetForm, sessions: parseInt(e.target.value) || 0})} className="w-full border rounded-lg p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">目标里程</label>
                            <input type="number" value={targetForm.km} onChange={e => setTargetForm({...targetForm, km: parseFloat(e.target.value) || 0})} className="w-full border rounded-lg p-2" />
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex gap-3">
                    <button onClick={() => setShowTargetModal(false)} className="flex-1 py-2 text-gray-600 bg-gray-100 rounded-lg">取消</button>
                    <button onClick={handleSaveTarget} className="flex-1 py-2 bg-dolphin-blue text-white rounded-lg">保存</button>
                </div>
            </div>
        </div>
      )}

      {/* 2. Signin Modal */}
      {showSigninModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800">训练签到</h3>
                    <button onClick={() => setShowSigninModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                        <input type="date" value={signinForm.date} onChange={e => setSigninForm({...signinForm, date: e.target.value})} className="w-full border rounded-lg p-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">场次</label>
                            <input type="number" value={signinForm.sessions} onChange={e => setSigninForm({...signinForm, sessions: parseInt(e.target.value) || 0})} className="w-full border rounded-lg p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">里程</label>
                            <input type="number" value={signinForm.km} onChange={e => setSigninForm({...signinForm, km: parseFloat(e.target.value) || 0})} className="w-full border rounded-lg p-2" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                        <textarea value={signinForm.note} onChange={e => setSigninForm({...signinForm, note: e.target.value})} className="w-full border rounded-lg p-2 h-20" />
                    </div>
                </div>
                <div className="mt-6 flex gap-3">
                    <button onClick={() => setShowSigninModal(false)} className="flex-1 py-2 text-gray-600 bg-gray-100 rounded-lg">取消</button>
                    <button onClick={handleSignin} className="flex-1 py-2 bg-dolphin-gold text-white rounded-lg">确认签到</button>
                </div>
            </div>
        </div>
      )}

      {/* 3. Group Manager Modal */}
      {showGroupManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800">管理自定义组别</h3>
                    <button onClick={() => setShowGroupManager(false)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                
                {/* Create New Group */}
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                    <h4 className="font-medium text-gray-800 mb-3 flex items-center"><Plus className="w-4 h-4 mr-1"/> 新建组别</h4>
                    <div className="space-y-3">
                        <input 
                            type="text" 
                            placeholder="组别名称 (如: 19-20年精英组)" 
                            value={groupForm.name}
                            onChange={e => setGroupForm({...groupForm, name: e.target.value})}
                            className="w-full border rounded p-2 text-sm"
                        />
                        <div>
                            <p className="text-xs text-gray-500 mb-1">包含年份 (多选)</p>
                            <div className="flex flex-wrap gap-2">
                                {birthYears.map(y => (
                                    <button 
                                        key={y}
                                        onClick={() => {
                                            const newYears = groupForm.years.includes(y) 
                                                ? groupForm.years.filter(year => year !== y)
                                                : [...groupForm.years, y];
                                            setGroupForm({...groupForm, years: newYears});
                                        }}
                                        className={`px-2 py-1 text-xs rounded border ${groupForm.years.includes(y) ? 'bg-dolphin-blue text-white border-dolphin-blue' : 'bg-white text-gray-600 border-gray-200'}`}
                                    >
                                        {y}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={groupForm.isPinned} onChange={e => setGroupForm({...groupForm, isPinned: e.target.checked})} className="rounded text-dolphin-blue" />
                            <span className="text-sm text-gray-600">置顶</span>
                        </label>
                        <button onClick={handleCreateGroup} disabled={!groupForm.name || groupForm.years.length === 0} className="w-full bg-dolphin-blue text-white py-2 rounded text-sm disabled:opacity-50">创建</button>
                    </div>
                </div>

                {/* List Groups */}
                <div className="space-y-2">
                    {customGroups.map(g => (
                        <div key={g.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                                <div className="font-medium">{g.name}</div>
                                <div className="text-xs text-gray-500">{g.birth_years.join(", ")}年</div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => toggleGroupPin(g.id, g.is_pinned)} className={`p-1.5 rounded ${g.is_pinned ? 'text-dolphin-gold bg-yellow-50' : 'text-gray-400'}`}><Pin className="w-4 h-4"/></button>
                                <button onClick={() => handleDeleteGroup(g.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* 4. Period Manager Modal */}
      {showPeriodManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800">管理周期</h3>
                    <button onClick={() => setShowPeriodManager(false)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>

                <div className="bg-blue-50 p-2 text-xs text-blue-800 rounded mb-4">
                    正在管理: {selectedGroup === 'all' ? '全部组别' : selectedGroup.startsWith('year_') ? `${selectedGroup.replace('year_', '')}年组` : customGroups.find(g => `group_${g.id}` === selectedGroup)?.name} 的周期
                </div>

                {/* Create Period */}
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                    <h4 className="font-medium text-gray-800 mb-3 flex items-center"><Plus className="w-4 h-4 mr-1"/> 新建周期</h4>
                    <div className="space-y-3">
                        <input 
                            type="text" 
                            placeholder="周期名称 (如: 春季集训一期)" 
                            value={periodForm.name}
                            onChange={e => setPeriodForm({...periodForm, name: e.target.value})}
                            className="w-full border rounded p-2 text-sm"
                        />
                        <div className="flex gap-2">
                            <input type="date" value={periodForm.start} onChange={e => setPeriodForm({...periodForm, start: e.target.value})} className="w-full border rounded p-2 text-sm" />
                            <input type="date" value={periodForm.end} onChange={e => setPeriodForm({...periodForm, end: e.target.value})} className="w-full border rounded p-2 text-sm" />
                        </div>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={periodForm.isPinned} onChange={e => setPeriodForm({...periodForm, isPinned: e.target.checked})} className="rounded text-dolphin-blue" />
                            <span className="text-sm text-gray-600">置顶</span>
                        </label>
                        <button onClick={handleCreatePeriod} disabled={!periodForm.name || !periodForm.start || !periodForm.end} className="w-full bg-dolphin-blue text-white py-2 rounded text-sm disabled:opacity-50">创建</button>
                    </div>
                </div>

                {/* List Periods */}
                <div className="space-y-2">
                    {customPeriods.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                                <div className="font-medium">{p.name}</div>
                                <div className="text-xs text-gray-500">{p.start_date} ~ {p.end_date}</div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => togglePeriodPin(p.id, p.is_pinned, p)} className={`p-1.5 rounded ${p.is_pinned ? 'text-dolphin-gold bg-yellow-50' : 'text-gray-400'}`}><Pin className="w-4 h-4"/></button>
                                <button onClick={() => handleDeletePeriod(p.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
