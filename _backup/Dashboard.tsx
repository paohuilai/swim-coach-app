import { useState, useEffect, useMemo } from "react";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "../lib/supabase";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, subYears, isAfter, isBefore } from "date-fns";
import { Calendar, Filter, Target, CheckCircle, Plus, Save, X, AlertCircle, Settings, Trash2, Pin, Users, Edit2, Clock, CheckSquare, Folder, ChevronRight, ChevronDown } from "lucide-react";
import { CoachTarget, CoachSignin, CoachCustomGroup, CoachPeriod, CoachGoal, TrainingTask } from "../types";

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  
  // --- States ---

  // Selection
  const [selectedGroup, setSelectedGroup] = useState<string>("all"); // "all", "year_2019", "group_uuid"
  
  // Data Lists
  const [birthYears, setBirthYears] = useState<number[]>([]);
  const [customGroups, setCustomGroups] = useState<CoachCustomGroup[]>([]);
  
  // Dashboard Data
  // const [currentGoal, setCurrentGoal] = useState<CoachGoal | null>(null); // Goal Removed
  const [tasks, setTasks] = useState<TrainingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // History State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyGoals, setHistoryGoals] = useState<CoachGoal[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDateRange, setHistoryDateRange] = useState({ start: "", end: "" });
  
  // Task History State
  const [showTaskHistoryModal, setShowTaskHistoryModal] = useState(false);
  const [taskHistory, setTaskHistory] = useState<TrainingTask[]>([]);
  const [taskHistoryLoading, setTaskHistoryLoading] = useState(false);
  const [taskHistoryFilter, setTaskHistoryFilter] = useState({ start: "", end: "", keyword: "" });

  // Modals
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);
  
  // Forms
  const [goalContent, setGoalContent] = useState("");
  // Goal Period State
  const [goalPeriodType, setGoalPeriodType] = useState<'1week' | '1month' | '3months' | 'custom'>('1month');
  const [goalStartDate, setGoalStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [goalEndDate, setGoalEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const [taskForm, setTaskForm] = useState({ content: "", deadline: "" });
  const [taskCreating, setTaskCreating] = useState(false); // Add loading state
  const [completingTask, setCompletingTask] = useState<TrainingTask | null>(null);
  const [completeStatus, setCompleteStatus] = useState<'on_time' | 'delayed'>('on_time');
  
  // Manager Forms
  const [groupForm, setGroupForm] = useState<{ name: string; years: number[]; isPinned: boolean }>({ name: "", years: [], isPinned: false });

  // --- Effects ---

  useEffect(() => {
    if (user) {
      fetchMeta();
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, selectedGroup]);

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
            setSelectedGroup(`group_${pinned.id}`);
        }
    }
  }

  async function fetchData() {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
        // Determine Context
        let birthYear: number | null = null;
        let customGroupId: string | null = null;

        if (selectedGroup.startsWith("year_")) {
            birthYear = parseInt(selectedGroup.replace("year_", ""));
        } else if (selectedGroup.startsWith("group_")) {
            customGroupId = selectedGroup.replace("group_", "");
        }

        // 1. Fetch Current Goal (Removed as per request)
        /*
        let goalQuery = supabase
            .from("coach_goals")
            .select("*")
            .eq("coach_id", user.id)
            .eq("is_active", true);
        
        if (customGroupId) {
            goalQuery = goalQuery.eq("custom_group_id", customGroupId);
        } else if (birthYear) {
            goalQuery = goalQuery.eq("birth_year", birthYear);
        } else {
            goalQuery = goalQuery.is("custom_group_id", null).is("birth_year", null);
        }

        const { data: goalData, error: goalError } = await goalQuery.maybeSingle();
        if (goalError) throw goalError;

        setCurrentGoal(goalData);
        if (goalData) setGoalContent(goalData.content);
        else setGoalContent("");
        */

        // 2. Fetch Tasks (Pending or Completed recently?)
        // Let's fetch all active (pending) tasks and recent completed ones
        let taskQuery = supabase
            .from("training_tasks")
            .select("*")
            .eq("coach_id", user.id)
            .order("created_at", { ascending: false });

        if (customGroupId) {
            taskQuery = taskQuery.eq("custom_group_id", customGroupId);
        } else if (birthYear) {
            taskQuery = taskQuery.eq("birth_year", birthYear);
        } else {
            taskQuery = taskQuery.is("custom_group_id", null).is("birth_year", null);
        }

        const { data: taskData, error: taskError } = await taskQuery;
        if (taskError) throw taskError;

        setTasks(taskData || []);
    } catch (err: any) {
        console.error("Dashboard Fetch Error:", err);
        setError("无法加载仪表盘数据，请检查网络或联系管理员。");
    } finally {
        setLoading(false);
    }
  }

  async function fetchGoalHistory() {
      if (!user) return;
      setHistoryLoading(true);
      
      const context = getContext();
      
      let query = supabase
          .from("coach_goals")
          .select("*")
          .eq("coach_id", user.id)
          .eq("is_active", false) // Only history
          .order("created_at", { ascending: false });

      if (context.customGroupId) query = query.eq("custom_group_id", context.customGroupId);
      else if (context.birthYear) query = query.eq("birth_year", context.birthYear);
      else query = query.is("custom_group_id", null).is("birth_year", null);

      if (historyDateRange.start) query = query.gte("created_at", historyDateRange.start);
      if (historyDateRange.end) query = query.lte("created_at", historyDateRange.end);

      const { data, error } = await query;
      if (!error) setHistoryGoals(data || []);
      setHistoryLoading(false);
  }

  async function fetchTaskHistory() {
      if (!user) return;
      setTaskHistoryLoading(true);
      
      const context = getContext();
      
      let query = supabase
          .from("training_tasks")
          .select("*")
          .eq("coach_id", user.id)
          .order("created_at", { ascending: false });

      if (context.customGroupId) query = query.eq("custom_group_id", context.customGroupId);
      else if (context.birthYear) query = query.eq("birth_year", context.birthYear);
      else query = query.is("custom_group_id", null).is("birth_year", null);

      if (taskHistoryFilter.start) query = query.gte("created_at", taskHistoryFilter.start);
      if (taskHistoryFilter.end) query = query.lte("created_at", taskHistoryFilter.end);
      if (taskHistoryFilter.keyword) query = query.ilike("content", `%${taskHistoryFilter.keyword}%`);

      const { data, error } = await query;
      if (!error) setTaskHistory(data || []);
      setTaskHistoryLoading(false);
  }

  // --- Handlers ---

  function handlePeriodTypeChange(type: '1week' | '1month' | '3months' | 'custom') {
      setGoalPeriodType(type);
      const today = new Date();
      setGoalStartDate(format(today, 'yyyy-MM-dd'));
      
      if (type === '1week') {
          setGoalEndDate(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')); // Or just +7 days? Usually end of week or +7 days. Requirement says "1周". Let's assume +7 days or End of Week. Let's use +7 days for simplicity of "Period".
          // Actually, "1周" often means "This Week". But for goal setting, maybe "Next 7 days".
          // Let's stick to +6 days (inclusive).
          const end = new Date(today);
          end.setDate(end.getDate() + 6);
          setGoalEndDate(format(end, 'yyyy-MM-dd'));
      } else if (type === '1month') {
          const end = new Date(today);
          end.setMonth(end.getMonth() + 1);
          end.setDate(end.getDate() - 1);
          setGoalEndDate(format(end, 'yyyy-MM-dd'));
      } else if (type === '3months') {
          const end = new Date(today);
          end.setMonth(end.getMonth() + 3);
          end.setDate(end.getDate() - 1);
          setGoalEndDate(format(end, 'yyyy-MM-dd'));
      }
      // 'custom' keeps current values or user edits them
  }

  async function handleSaveGoal() {
    if (!user || !goalContent) return;
    
    // Validation
    if (goalPeriodType === 'custom') {
        if (!goalStartDate || !goalEndDate) {
            alert("请选择完整的起止日期");
            return;
        }
        if (isAfter(new Date(goalStartDate), new Date(goalEndDate))) {
            alert("结束日期不能早于开始日期");
            return;
        }
    }

    const context = getContext();

    // Deactivate old goal if exists? 
    // The requirement says "Record goal entry time... Provide history".
    // So we should just insert a new one and mark it active, and update old ones to inactive.
    
    // Use RPC for Atomic Transaction
    const { data: rpcData, error: rpcError } = await supabase.rpc('set_coach_goal', {
        p_coach_id: user.id,
        p_content: goalContent,
        p_birth_year: context.birthYear,
        p_custom_group_id: context.customGroupId,
        p_period_type: goalPeriodType,
        p_start_date: goalStartDate,
        p_end_date: goalEndDate
    });

    if (rpcError) {
        console.error("Failed to save goal via RPC:", rpcError);
        alert("保存失败，请稍后重试");
        return;
    }
    
    setShowGoalModal(false);
    fetchData();
  }

  async function handleCreateTask() {
    if (!user || !taskForm.content) return;
    
    setTaskCreating(true);
    const context = getContext();

    // Use RPC for Task Creation
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_training_task', {
        p_coach_id: user.id,
        p_content: taskForm.content,
        p_deadline: taskForm.deadline || null,
        p_birth_year: context.birthYear,
        p_custom_group_id: context.customGroupId
    });

    setTaskCreating(false);

    if (rpcError) {
        console.error("Failed to create task via RPC:", rpcError);
        alert("发布任务失败，请稍后重试");
        return;
    }

    if (rpcData && !rpcData.success) {
        console.error("Task creation failed (Application Error):", rpcData.error);
        alert("发布任务失败: " + rpcData.error);
        return;
    }

    setShowTaskModal(false);
    setTaskForm({ content: "", deadline: "" });
    fetchData();
  }

  async function handleCompleteTask() {
      if (!completingTask) return;

      await supabase.from("training_tasks").update({
          status: completeStatus,
          completed_at: new Date().toISOString()
      }).eq("id", completingTask.id);

      setShowCompleteModal(false);
      setCompletingTask(null);
      fetchData();
  }

  function getContext() {
    let birthYear: number | null = null;
    let customGroupId: string | null = null;
    if (selectedGroup.startsWith("year_")) {
        birthYear = parseInt(selectedGroup.replace("year_", ""));
    } else if (selectedGroup.startsWith("group_")) {
        customGroupId = selectedGroup.replace("group_", "");
    }
    return { birthYear, customGroupId };
  }

  // Group Management Handlers
  async function handleCreateGroup() {
    if (!user || !groupForm.name) return;

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
    fetchCustomGroups(true); 
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
        await supabase.from("coach_custom_groups").update({ is_pinned: false }).eq("coach_id", user.id);
    }
    await supabase.from("coach_custom_groups").update({ is_pinned: !current }).eq("id", id);
    fetchCustomGroups(true);
  }

  if (!isLoaded) return <div className="flex justify-center p-8">加载中...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-dolphin-blue flex items-center">
                <Target className="w-6 h-6 mr-2 text-dolphin-gold" />
                目标与进度
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
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">出错啦：</strong>
            <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Task/Check-in Card */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden flex flex-col h-full">
            <div className="bg-dolphin-gold/5 p-4 border-b border-dolphin-gold/10 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold text-dolphin-dark flex items-center">
                        <CheckSquare className="w-5 h-5 mr-2 text-dolphin-gold" />
                        进度打卡
                    </h3>
                    <button 
                        onClick={() => { setShowTaskHistoryModal(true); fetchTaskHistory(); }}
                        className="text-xs text-gray-400 hover:text-dolphin-gold flex items-center bg-white px-2 py-1 rounded border border-gray-100 shadow-sm"
                    >
                        <Clock className="w-3 h-3 mr-1" />
                        历史记录
                    </button>
                </div>
                <button onClick={() => setShowTaskModal(true)} className="bg-dolphin-gold text-white text-sm px-4 py-1.5 rounded-full hover:bg-yellow-500 transition-colors flex items-center shadow-sm">
                    <Plus className="w-4 h-4 mr-1" />
                    发布任务
                </button>
            </div>
            
            <div className="p-0 flex-1 overflow-y-auto max-h-[600px]">
                {tasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <Clock className="w-10 h-10 mx-auto mb-2 opacity-50"/>
                        暂无训练任务
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {tasks.map(task => (
                            <div key={task.id} className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-start">
                                <div>
                                    <p className={`font-medium ${task.status !== 'pending' ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                        {task.content}
                                    </p>
                                    <div className="flex gap-2 mt-1 text-xs">
                                        <span className="text-gray-400">
                                            {format(new Date(task.created_at), 'yyyy-MM-dd HH:mm')}
                                        </span>
                                        {task.deadline && (
                                            <span className="flex items-center text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                <Clock className="w-3 h-3 mr-1"/>
                                                截止: {task.deadline}
                                            </span>
                                        )}
                                        {task.status === 'on_time' && <span className="text-green-600 font-bold">按时达成</span>}
                                        {task.status === 'delayed' && <span className="text-red-500 font-bold">延迟达成</span>}
                                    </div>
                                </div>
                                {task.status === 'pending' && (
                                    <button 
                                        onClick={() => { setCompletingTask(task); setShowCompleteModal(true); }}
                                        className="text-sm text-blue-600 hover:bg-blue-50 px-3 py-1 rounded border border-blue-200"
                                    >
                                        打卡
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* 1. Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800">设置目标</h3>
                    <button onClick={() => setShowGoalModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <div className="space-y-4">
                    <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                        针对组别：{selectedGroup === 'all' ? '全部组别' : selectedGroup.startsWith('year_') ? `${selectedGroup.replace('year_', '')}年组` : customGroups.find(g => `group_${g.id}` === selectedGroup)?.name}
                    </div>

                    {/* Period Selector */}
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">目标周期</label>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            {(['1week', '1month', '3months', 'custom'] as const).map(type => (
                                <button
                                    key={type}
                                    onClick={() => handlePeriodTypeChange(type)}
                                    className={`flex-1 text-xs py-2 rounded-md transition-all ${
                                        goalPeriodType === type 
                                        ? 'bg-white text-dolphin-blue shadow-sm font-bold' 
                                        : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    {type === '1week' ? '1周' : type === '1month' ? '1个月' : type === '3months' ? '3个月' : '自定义'}
                                </button>
                            ))}
                        </div>
                        
                        {goalPeriodType === 'custom' && (
                            <div className="flex items-center gap-2 mt-3 animate-fade-in">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-400 block mb-1">开始日期</label>
                                    <input 
                                        type="date" 
                                        value={goalStartDate}
                                        onChange={e => setGoalStartDate(e.target.value)}
                                        className="w-full border rounded px-2 py-1.5 text-sm"
                                    />
                                </div>
                                <span className="text-gray-400 self-end mb-2">~</span>
                                <div className="flex-1">
                                    <label className="text-xs text-gray-400 block mb-1">结束日期</label>
                                    <input 
                                        type="date" 
                                        value={goalEndDate}
                                        min={goalStartDate}
                                        onChange={e => setGoalEndDate(e.target.value)}
                                        className="w-full border rounded px-2 py-1.5 text-sm"
                                    />
                                </div>
                            </div>
                        )}
                         {/* Display computed dates for non-custom */}
                         {goalPeriodType !== 'custom' && (
                            <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                周期：{goalStartDate} ~ {goalEndDate}
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-gray-700">目标内容</label>
                            <span className={`text-xs ${goalContent.length > 500 ? 'text-red-500' : 'text-gray-400'}`}>
                                {goalContent.length}/500
                            </span>
                        </div>
                        <textarea 
                            value={goalContent} 
                            onChange={e => setGoalContent(e.target.value)} 
                            placeholder="例如：市运会三枚金牌，或者 XX运动员在30天内蛙泳进步2秒"
                            className="w-full border rounded-lg p-3 h-32 text-sm focus:ring-2 focus:ring-dolphin-blue focus:outline-none" 
                            maxLength={500}
                        />
                    </div>
                </div>
                <div className="mt-6 flex gap-2">
                    <button onClick={() => setShowGoalModal(false)} className="flex-1 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">取消</button>
                    <button 
                        onClick={handleSaveGoal} 
                        disabled={!goalContent || (goalPeriodType === 'custom' && (!goalStartDate || !goalEndDate))}
                        className="flex-1 py-2 bg-dolphin-blue text-white rounded-lg hover:bg-dolphin-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >保存目标</button>
                </div>
            </div>
        </div>
      )}

      {/* 2. Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800">发布训练任务</h3>
                    <button onClick={() => setShowTaskModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">任务内容</label>
                        <textarea 
                            value={taskForm.content} 
                            onChange={e => setTaskForm({...taskForm, content: e.target.value})} 
                            placeholder="例如：3日内50米自由泳游到30秒"
                            className="w-full border rounded-lg p-3 h-24" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">截止日期 (可选)</label>
                        <input type="date" value={taskForm.deadline} onChange={e => setTaskForm({...taskForm, deadline: e.target.value})} className="w-full border rounded-lg p-2" />
                    </div>
                </div>
                <div className="mt-6 flex gap-3">
                    <button onClick={() => setShowTaskModal(false)} className="flex-1 py-2 text-gray-600 bg-gray-100 rounded-lg">取消</button>
                    <button 
                        onClick={handleCreateTask} 
                        disabled={taskCreating || !taskForm.content}
                        className="flex-1 py-2 bg-dolphin-gold text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {taskCreating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                发布中...
                            </>
                        ) : "发布任务"}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* 3. Complete Task Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">确认完成情况</h3>
                <p className="text-gray-600 mb-6">{completingTask?.content}</p>
                
                <div className="flex gap-4 mb-6">
                    <label className={`flex-1 cursor-pointer border-2 rounded-lg p-3 text-center ${completeStatus === 'on_time' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200'}`}>
                        <input type="radio" className="hidden" checked={completeStatus === 'on_time'} onChange={() => setCompleteStatus('on_time')} />
                        <div className="font-bold">按时达成</div>
                    </label>
                    <label className={`flex-1 cursor-pointer border-2 rounded-lg p-3 text-center ${completeStatus === 'delayed' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200'}`}>
                        <input type="radio" className="hidden" checked={completeStatus === 'delayed'} onChange={() => setCompleteStatus('delayed')} />
                        <div className="font-bold">延迟达成</div>
                    </label>
                </div>

                <div className="flex gap-3">
                    <button onClick={() => setShowCompleteModal(false)} className="flex-1 py-2 text-gray-600 bg-gray-100 rounded-lg">取消</button>
                    <button onClick={handleCompleteTask} className="flex-1 py-2 bg-blue-600 text-white rounded-lg">确认</button>
                </div>
            </div>
        </div>
      )}

      {/* 4. Group Manager Modal */}
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
      {/* 5. Goal History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center">
                        <Clock className="w-5 h-5 mr-2 text-dolphin-blue" />
                        历史目标记录
                    </h3>
                    <button onClick={() => setShowHistoryModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                
                {/* Filters */}
                <div className="bg-gray-50 p-4 rounded-lg mb-4 flex flex-col gap-3 flex-shrink-0">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Date Range */}
                        <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-gray-200">
                             <Clock className="w-4 h-4 text-gray-400" />
                             <input 
                                type="date" 
                                value={historyDateRange.start}
                                onChange={e => setHistoryDateRange({...historyDateRange, start: e.target.value})}
                                className="border-none text-xs w-24 focus:ring-0 p-0"
                                placeholder="开始"
                            />
                            <span className="text-gray-300">-</span>
                            <input 
                                type="date" 
                                value={historyDateRange.end}
                                onChange={e => setHistoryDateRange({...historyDateRange, end: e.target.value})}
                                className="border-none text-xs w-24 focus:ring-0 p-0"
                                placeholder="结束"
                            />
                        </div>
                        
                        {/* Group Multi-select (Simplified for now as single select + 'all') */}
                         <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-gray-200 min-w-[120px]">
                            <Users className="w-4 h-4 text-gray-400" />
                            <select 
                                className="border-none text-xs w-full focus:ring-0 p-0 bg-transparent"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') setHistoryGroupFilter([]);
                                    else setHistoryGroupFilter([val]);
                                }}
                            >
                                <option value="">所有组别</option>
                                <option value="all">未分组(全局)</option>
                                {birthYears.map(y => <option key={y} value={`year_${y}`}>{y}年组</option>)}
                                {customGroups.map(g => <option key={g.id} value={`group_${g.id}`}>{g.name}</option>)}
                            </select>
                         </div>

                        <button 
                            onClick={fetchGoalHistory}
                            className="bg-dolphin-blue text-white px-4 py-1.5 rounded text-xs font-medium hover:bg-dolphin-dark transition-colors"
                        >
                            查询
                        </button>

                         <div className="ml-auto flex items-center gap-2 text-xs">
                             <button onClick={expandAllHistory} className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded">展开全部</button>
                             <button onClick={collapseAllHistory} className="text-gray-500 hover:bg-gray-100 px-2 py-1 rounded">收起全部</button>
                         </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500 border-t border-gray-200 pt-2">
                        <span>排序：</span>
                        <button 
                            onClick={() => setSortOrder('created_desc')}
                            className={`px-2 py-0.5 rounded ${sortOrder === 'created_desc' ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-gray-100'}`}
                        >
                            创建时间
                        </button>
                        <button 
                            onClick={() => setSortOrder('period_desc')}
                            className={`px-2 py-0.5 rounded ${sortOrder === 'period_desc' ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-gray-100'}`}
                        >
                            目标周期
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-1">
                    {historyLoading ? (
                        <div className="text-center py-12 text-gray-400 flex flex-col items-center">
                            <div className="w-8 h-8 border-4 border-dolphin-blue border-t-transparent rounded-full animate-spin mb-2"></div>
                            加载中...
                        </div>
                    ) : Object.keys(groupedHistory).length === 0 ? (
                        <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            暂无历史目标记录
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {Object.keys(groupedHistory).sort((a,b) => b.localeCompare(a)).map(year => (
                                <div key={year} className="border border-gray-200 rounded-lg overflow-hidden">
                                    {/* Level 1: Year */}
                                    <div 
                                        className="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => toggleHistoryYear(year)}
                                    >
                                        <div className="flex items-center gap-2">
                                            {expandedHistoryYears.has(year) ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                                            <Folder className="w-4 h-4 text-dolphin-blue" />
                                            <span className="font-bold text-gray-800">{year}</span>
                                        </div>
                                    </div>

                                    {expandedHistoryYears.has(year) && (
                                        <div className="bg-white">
                                            {Object.keys(groupedHistory[year]).sort().map(quarter => (
                                                <div key={quarter} className="border-t border-gray-100">
                                                    {/* Level 2: Quarter */}
                                                    <div 
                                                        className="px-8 py-2 flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors"
                                                        onClick={() => toggleHistoryQuarter(`${year}-${quarter}`)}
                                                    >
                                                        {expandedHistoryQuarters.has(`${year}-${quarter}`) ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                                                        <span className="text-sm font-medium text-gray-700">{quarter}</span>
                                                    </div>

                                                    {expandedHistoryQuarters.has(`${year}-${quarter}`) && (
                                                        <div className="px-8 pb-2">
                                                            {Object.keys(groupedHistory[year][quarter]).sort((a,b) => parseInt(a) - parseInt(b)).map(month => (
                                                                <div key={month} className="ml-4 border-l-2 border-gray-100 pl-4 py-2">
                                                                     {/* Level 3: Month Header (Optional, maybe just list items?) Request says Level 3 is Month Grouping */}
                                                                    <div 
                                                                        className="flex items-center gap-2 cursor-pointer mb-2"
                                                                        onClick={() => toggleHistoryMonth(`${year}-${quarter}-${month}`)}
                                                                    >
                                                                         {expandedHistoryMonths.has(`${year}-${quarter}-${month}`) ? <ChevronDown className="w-3 h-3 text-gray-300" /> : <ChevronRight className="w-3 h-3 text-gray-300" />}
                                                                         <span className="text-xs font-bold text-gray-400">{month}</span>
                                                                    </div>

                                                                    {expandedHistoryMonths.has(`${year}-${quarter}-${month}`) && (
                                                                        <div className="space-y-2">
                                                                            {groupedHistory[year][quarter][month].map(goal => (
                                                                                <div key={goal.id} className="bg-white border border-gray-100 rounded p-3 hover:shadow-sm transition-shadow group">
                                                                                    <div className="flex justify-between items-start mb-2">
                                                                                        <div className="flex flex-col">
                                                                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                                                                <Clock className="w-3 h-3" />
                                                                                                {goal.start_date && goal.end_date ? `${goal.start_date} ~ ${goal.end_date}` : format(new Date(goal.created_at), 'yyyy-MM-dd')}
                                                                                            </span>
                                                                                        </div>
                                                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                                                                            goal.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                                                            goal.status === 'expired' ? 'bg-red-100 text-red-700' :
                                                                                            goal.is_active ? 'bg-blue-100 text-blue-700' :
                                                                                            'bg-gray-100 text-gray-500'
                                                                                        }`}>
                                                                                            {goal.is_active ? '进行中' : goal.status === 'completed' ? '已完成' : goal.status === 'expired' ? '已过期' : '已结束'}
                                                                                        </span>
                                                                                    </div>
                                                                                    <p className="text-sm text-gray-800 line-clamp-2 group-hover:line-clamp-none transition-all" title={goal.content}>
                                                                                        {goal.content}
                                                                                    </p>
                                                                                    <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between items-center">
                                                                                        <span className="text-xs text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded">
                                                                                            {goal.birth_year ? `${goal.birth_year}年组` : goal.custom_group_id ? '自定义组' : '全部组别'}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
      {/* 6. Task History Modal */}
      {showTaskHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center">
                        <Clock className="w-5 h-5 mr-2 text-dolphin-gold" />
                        打卡历史记录
                    </h3>
                    <button onClick={() => setShowTaskHistoryModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                
                {/* Filters */}
                <div className="bg-gray-50 p-3 rounded-lg mb-4 flex flex-col gap-2 flex-shrink-0">
                    <div className="flex gap-2">
                        <input 
                            type="date" 
                            value={taskHistoryFilter.start}
                            onChange={e => setTaskHistoryFilter({...taskHistoryFilter, start: e.target.value})}
                            className="border rounded px-2 py-1 text-xs w-full"
                            placeholder="开始日期"
                        />
                        <span className="text-gray-400 self-center">-</span>
                        <input 
                            type="date" 
                            value={taskHistoryFilter.end}
                            onChange={e => setTaskHistoryFilter({...taskHistoryFilter, end: e.target.value})}
                            className="border rounded px-2 py-1 text-xs w-full"
                            placeholder="结束日期"
                        />
                    </div>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={taskHistoryFilter.keyword}
                            onChange={e => setTaskHistoryFilter({...taskHistoryFilter, keyword: e.target.value})}
                            className="border rounded px-2 py-1 text-xs w-full"
                            placeholder="搜索打卡内容..."
                        />
                        <button 
                            onClick={fetchTaskHistory}
                            className="bg-dolphin-gold text-white px-3 py-1 rounded text-xs whitespace-nowrap"
                        >
                            查询
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {taskHistoryLoading ? (
                        <div className="text-center py-8 text-gray-400">加载中...</div>
                    ) : taskHistory.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">暂无打卡记录</div>
                    ) : (
                        taskHistory.map(task => (
                            <div key={task.id} className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                        {format(new Date(task.created_at), "yyyy-MM-dd HH:mm")}
                                    </span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                        task.status === 'on_time' ? 'bg-green-100 text-green-700' :
                                        task.status === 'delayed' ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-500'
                                    }`}>
                                        {task.status === 'on_time' ? '按时达成' : task.status === 'delayed' ? '延迟达成' : '未完成'}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{task.content}</p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
