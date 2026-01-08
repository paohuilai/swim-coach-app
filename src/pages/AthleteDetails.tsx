import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, X, Activity, UserCog } from "lucide-react";
import ReactECharts from "echarts-for-react";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "../lib/supabase";
import { Athlete, TrainingLog, AthleteStatusHistory } from "../types";
import { format, subMonths, subYears, isAfter, parseISO, differenceInDays, subDays } from "date-fns";

const VENUE_OPTIONS = ["东山馆", "莘塍馆", "海城馆", "塘下馆", "开元馆", "飞云馆", "其他"];
const TEAM_OPTIONS = ["一队", "二队", "三队", "四队", "五队", "其他"];

const STATUS_CONFIG = {
  training: { label: "在训", color: "text-green-600 bg-green-50" },
  paused: { label: "停训", color: "text-gray-600 bg-gray-50" },
  trial: { label: "走训", color: "text-orange-600 bg-orange-50" },
  transferred: { label: "输送", color: "text-purple-600 bg-purple-50" }
};

interface AthleteWithHistory extends Athlete {
    athlete_status_history?: AthleteStatusHistory[];
}

export default function AthleteDetails() {
  const { id } = useParams();
  const { user, isLoaded } = useUser();
  const [athlete, setAthlete] = useState<AthleteWithHistory | null>(null);
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("all");

  // Edit Modal State
  const [editingLog, setEditingLog] = useState<TrainingLog | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editDistance, setEditDistance] = useState("");
  const [editStatusScore, setEditStatusScore] = useState("");
  const [editStatusNote, setEditStatusNote] = useState("");
  const [editEntries, setEditEntries] = useState<{stroke: string, time: string}[]>([]);

  // Venue/Team Edit State
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [venueSelect, setVenueSelect] = useState(VENUE_OPTIONS[0]);
  const [venueCustom, setVenueCustom] = useState("");
  const [teamSelect, setTeamSelect] = useState(TEAM_OPTIONS[0]);
  const [teamCustom, setTeamCustom] = useState("");

  // Status Edit State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [status, setStatus] = useState<AthleteStatusHistory['status']>('training');
  const [statusStartDate, setStatusStartDate] = useState("");
  const [statusEndDate, setStatusEndDate] = useState("");
  const [transferDest, setTransferDest] = useState("");

  const CURRENT_YEAR = new Date().getFullYear();

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  async function fetchData() {
    setLoading(true);
    // Fetch Athlete with History
    const { data: athleteData, error } = await supabase
      .from("athletes")
      .select(`
        *,
        athlete_status_history (*)
      `)
      .eq("id", id)
      .single();
    
    if (error) {
        console.error(error);
    }
    setAthlete(athleteData);
    
    // Set initial status modal state from current status
    if (athleteData) {
        const history = athleteData.athlete_status_history as AthleteStatusHistory[] || [];
        const sortedHistory = [...history].sort((a,b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
        const current = sortedHistory.find(h => !h.end_date) || sortedHistory[0];
        
        if (current) {
            setStatus(current.status);
            setStatusStartDate(current.start_date);
            setTransferDest(current.destination || "");
        } else {
            // Default
            setStatus('training');
            setStatusStartDate(new Date().toISOString().split('T')[0]);
        }
    }

    // Fetch Logs with performances
    const { data: logsData } = await supabase
      .from("training_logs")
      .select(`
        *,
        performance_entries (*)
      `)
      .eq("athlete_id", id)
      .order("date", { ascending: false });

    setLogs(logsData || []);
    setLoading(false);
  }

  async function handleDeleteLog(logId: string) {
    if (!confirm("确定要删除这条记录吗？")) return;

    const { error } = await supabase.from("training_logs").delete().eq("id", logId);
    if (error) {
      alert("删除记录失败: " + error.message);
    } else {
      fetchData();
    }
  }

  function openEditModal(log: TrainingLog) {
    setEditingLog(log);
    setEditDate(log.date);
    setEditDistance(log.distance_km.toString());
    setEditStatusScore(log.status_score?.toString() || "");
    setEditStatusNote(log.status_note || "");
    
    const entries = log.performance_entries?.map(p => ({
      stroke: p.stroke,
      time: p.time_seconds.toString()
    })) || [];
    
    if (entries.length === 0) {
      entries.push({ stroke: "", time: "" });
    }
    setEditEntries(entries);
  }

  function handleEditEntryChange(index: number, field: 'stroke' | 'time', value: string) {
    const newEntries = [...editEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEditEntries(newEntries);
  }

  function addEditEntry() {
    setEditEntries([...editEntries, { stroke: "", time: "" }]);
  }

  function removeEditEntry(index: number) {
    const newEntries = editEntries.filter((_, i) => i !== index);
    setEditEntries(newEntries);
  }

  async function handleUpdateLog(e: React.FormEvent) {
    e.preventDefault();
    if (!editingLog) return;

    // 1. Update Log
    const { error: logError } = await supabase
      .from("training_logs")
      .update({
        date: editDate,
        distance_km: parseFloat(editDistance),
        status_score: editStatusScore ? parseInt(editStatusScore) : null,
        status_note: editStatusNote
      })
      .eq("id", editingLog.id);

    if (logError) {
      alert("更新记录失败: " + logError.message);
      return;
    }

    // 2. Update Entries
    const { error: deleteError } = await supabase
      .from("performance_entries")
      .delete()
      .eq("log_id", editingLog.id);

    if (deleteError) {
      alert("更新成绩失败: " + deleteError.message);
      return;
    }

    const validEntries = editEntries.filter(e => e.stroke && e.time).map(e => ({
      log_id: editingLog.id,
      stroke: e.stroke,
      time_seconds: parseFloat(e.time)
    }));

    if (validEntries.length > 0) {
      const { error: insertError } = await supabase
        .from("performance_entries")
        .insert(validEntries);
        
      if (insertError) {
        alert("添加成绩失败: " + insertError.message);
        return;
      }
    }

    setEditingLog(null);
    fetchData();
  }

  // Venue Logic
  function openVenueModal() {
    const currentVenue = athlete?.venue || "";
    if (VENUE_OPTIONS.includes(currentVenue)) {
      setVenueSelect(currentVenue);
      setVenueCustom("");
    } else {
      setVenueSelect("其他");
      setVenueCustom(currentVenue);
    }
    const currentTeam = athlete?.team || "";
    if (TEAM_OPTIONS.includes(currentTeam)) {
      setTeamSelect(currentTeam);
      setTeamCustom("");
    } else {
      setTeamSelect("其他");
      setTeamCustom(currentTeam);
    }

    setShowVenueModal(true);
  }

  async function handleUpdateVenue(e: React.FormEvent) {
    e.preventDefault();
    if (!athlete) return;
    const finalVenue = venueSelect === "其他" ? venueCustom : venueSelect;
    const finalTeam = teamSelect === "其他" ? teamCustom : teamSelect;
    
    const { error } = await supabase.from("athletes").update({ 
      venue: finalVenue,
      team: finalTeam
    }).eq("id", athlete.id);

    if (error) {
      alert("更新场馆/队伍失败: " + error.message);
    } else {
      setShowVenueModal(false);
      fetchData();
    }
  }

  function getBadgeLabel(venue: string | null, team: string | null) {
    const v = venue || "未知场馆";
    const t = team || "未知队伍";
    return `${v}-${t}`;
  }

  // Status Logic
  function openStatusModal() {
    if (athlete) {
        const history = athlete.athlete_status_history || [];
        const sortedHistory = [...history].sort((a,b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
        const current = sortedHistory.find(h => !h.end_date) || sortedHistory[0];
        
        if (current) {
            setStatus(current.status);
            setStatusStartDate(current.start_date);
            setStatusEndDate(current.end_date || "");
            setTransferDest(current.destination || "");
        } else {
             setStatus('training');
             setStatusStartDate(new Date().toISOString().split('T')[0]);
             setStatusEndDate("");
             setTransferDest("");
        }
        setShowStatusModal(true);
    }
  }

  async function handleUpdateStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!athlete) return;
    
    // Ensure user is loaded
    if (!user || !user.id) {
        alert("认证错误：未找到用户，请刷新页面。");
        return;
    }

    try {
        const history = athlete.athlete_status_history || [];
        const sortedHistory = [...history].sort((a,b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
        const current = sortedHistory.find(h => !h.end_date) || sortedHistory[0];

        // If changing status type, close old and open new
        if (current && current.status !== status) {
            // Close old
            const newStart = new Date(statusStartDate);
            const endDate = subDays(newStart, 1);
            
            const { error: closeError } = await supabase.from("athlete_status_history")
                .update({ end_date: format(endDate, 'yyyy-MM-dd') })
                .eq("id", current.id);
            
            if (closeError) throw closeError;
            
            // Create new
            const { error: insertError } = await supabase.from("athlete_status_history").insert({
                athlete_id: athlete.id,
                coach_id: user.id,
                status,
                start_date: statusStartDate,
                end_date: statusEndDate || null,
                destination: (status === 'transferred' || status === 'trial') ? transferDest : null
            });
            
            if (insertError) throw insertError;

        } else {
            // Just update details of current
            if (current) {
                const { error: updateError } = await supabase.from("athlete_status_history")
                    .update({
                        start_date: statusStartDate,
                        end_date: statusEndDate || null,
                        destination: (status === 'transferred' || status === 'trial') ? transferDest : null
                    })
                    .eq("id", current.id);
                
                if (updateError) throw updateError;
            } else {
                 // Create initial if missing
                 const { error: insertError } = await supabase.from("athlete_status_history").insert({
                    athlete_id: athlete.id,
                    coach_id: user.id,
                    status,
                    start_date: statusStartDate,
                    end_date: statusEndDate || null,
                    destination: (status === 'transferred' || status === 'trial') ? transferDest : null
                });
                
                if (insertError) throw insertError;
            }
        }
        
        alert("状态已更新");
        setShowStatusModal(false);
        fetchData();

    } catch (error: any) {
        console.error("Error updating status:", error);
        alert("保存失败: " + (error.message || "未知错误"));
    }
  }

  // Chart Data Processing
  const chartData = useMemo(() => {
    let filtered = logs;
    const now = new Date();
    
    if (timeRange === "1m") {
        filtered = logs.filter(l => isAfter(parseISO(l.date), subMonths(now, 1)));
    } else if (timeRange === "3m") {
        filtered = logs.filter(l => isAfter(parseISO(l.date), subMonths(now, 3)));
    } else if (timeRange === "6m") {
        filtered = logs.filter(l => isAfter(parseISO(l.date), subMonths(now, 6)));
    } else if (timeRange === "1y") {
        filtered = logs.filter(l => isAfter(parseISO(l.date), subYears(now, 1)));
    }
    
    const sortedLogs = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const strokes = new Set<string>();
    sortedLogs.forEach(log => {
        log.performance_entries?.forEach(p => strokes.add(p.stroke));
    });

    let minTime = Infinity;
    let maxTime = -Infinity;

    // Series for Line Chart
    const series = Array.from(strokes).map(stroke => {
      const data = sortedLogs
        .map(log => {
          const entry = log.performance_entries?.find(p => p.stroke === stroke);
          if (entry) {
            minTime = Math.min(minTime, entry.time_seconds);
            maxTime = Math.max(maxTime, entry.time_seconds);
            return [log.date, entry.time_seconds];
          }
          return null;
        })
        .filter(Boolean);
        
      return {
        name: stroke,
        type: 'line',
        data: data,
        connectNulls: true
      };
    });

    if (minTime === Infinity) minTime = 0;
    if (maxTime === -Infinity) maxTime = 100;

    const distanceData = sortedLogs.map(log => [log.date, log.distance_km]);

    return { sortedLogs, strokes: Array.from(strokes), series, distanceData, minTime, maxTime };
  }, [logs, timeRange]);

  const filteredLogs = chartData.sortedLogs.slice().reverse();

  // Status Chart Data
  const statusChartData = useMemo(() => {
    const statusLogs = filteredLogs
        .filter(log => log.status_score !== null && log.status_score !== undefined)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
    const data = statusLogs.map(s => [s.date, s.status_score]);
    const average = statusLogs.length > 0 
        ? (statusLogs.reduce((acc, curr) => acc + (curr.status_score || 0), 0) / statusLogs.length).toFixed(1)
        : "0.0";
    
    return { data, average };
  }, [filteredLogs]);

  function formatDuration(days: number) {
    if (days <= 0) return "0天";
    const years = Math.floor(days / 365);
    const remainingDays = days % 365;
    const months = Math.floor(remainingDays / 30);
    
    if (years > 0) {
        return `${years}年${remainingDays}天`;
    }
    if (months > 0) {
        return `${months}个月${remainingDays % 30}天`;
    }
    return `${days}天`;
  }

  // Calculate Display Strings for Status
  const statusInfo = useMemo(() => {
    if (!athlete) return null;
    
    const history = athlete.athlete_status_history || [];
    const sortedHistory = [...history].sort((a,b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    const current = sortedHistory.find(h => !h.end_date) || sortedHistory[0];
    
    // Calculate cumulative days for each status
    const summary = { training: 0, paused: 0, trial: 0, transferred: 0 };
    
    history.forEach(h => {
        const start = parseISO(h.start_date);
        const end = h.end_date ? parseISO(h.end_date) : new Date();
        const days = differenceInDays(end, start);
        if (summary[h.status] !== undefined) {
            summary[h.status] += Math.max(0, days);
        }
    });

    return {
        current,
        summary
    };
  }, [athlete]);

  // Calculate Progress Rate
  const progressRates = useMemo(() => {
    const rates: Record<string, number | null> = {};
    
    chartData.strokes.forEach(stroke => {
      const entries = chartData.sortedLogs
        .map(log => ({
          date: log.date,
          entry: log.performance_entries?.find(p => p.stroke === stroke)
        }))
        .filter(item => item.entry);
        
      if (entries.length >= 2) {
        const latest = entries[entries.length - 1].entry!.time_seconds;
        const previous = entries[entries.length - 2].entry!.time_seconds;
        const rate = ((previous - latest) / previous) * 100;
        rates[stroke] = rate;
      } else {
        rates[stroke] = null;
      }
    });
    
    return rates;
  }, [chartData]);

  if (loading || !isLoaded) return <div className="p-8 text-center">加载中...</div>;
  if (!athlete) return <div className="p-8 text-center">未找到运动员</div>;

  const yMin = Math.max(0, chartData.minTime * 0.95);
  const yMax = chartData.maxTime * 1.05;

  const lineChartOption = {
    title: { text: '成绩趋势 (秒)' },
    tooltip: { trigger: 'axis' },
    legend: { data: chartData.strokes, bottom: 0 },
    grid: { bottom: 30 },
    xAxis: { type: 'category', boundaryGap: false },
    yAxis: { 
      type: 'value', 
      name: '秒',
      min: Math.floor(yMin * 10) / 10,
      max: Math.ceil(yMax * 10) / 10
    },
    series: chartData.series
  };

  const barChartOption = {
    title: { text: '训练量 (km)' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category' },
    yAxis: { type: 'value' },
    series: [{
      data: chartData.distanceData,
      type: 'bar',
      itemStyle: { color: '#3b82f6' }
    }]
  };

  const statusChartOption = {
    title: { text: '状态评分趋势 (0-100)' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', boundaryGap: false },
    yAxis: { type: 'value', min: 0, max: 100 },
    series: [{
        data: statusChartData.data,
        type: 'line',
        smooth: true,
        itemStyle: { color: '#10b981' },
        areaStyle: {
            color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#d1fae5' }]
            }
        }
    }]
  };

  const currentStatusKey = statusInfo?.current?.status || 'training';
  const currentStatusConfig = STATUS_CONFIG[currentStatusKey];

  return (
    <div className="space-y-8">
       {/* Header */}
       <div className="flex justify-between items-start">
         <div>
            <Link to="/athletes" className="text-gray-500 hover:text-gray-900 flex items-center mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> 返回列表
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                {athlete.name}
                <button 
                  onClick={openVenueModal}
                  className={`ml-3 px-2 py-0.5 rounded-full text-sm font-medium hover:bg-opacity-80 cursor-pointer ${
                    athlete.venue 
                      ? "bg-blue-100 text-blue-800 hover:bg-blue-200" 
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  [{getBadgeLabel(athlete.venue, athlete.team)}]
                </button>
            </h1>
            <p className="text-gray-500 mt-1">
              {athlete.birth_year ? `${athlete.birth_year}年 (当前${CURRENT_YEAR - athlete.birth_year}岁)` : "年份未知"} 
              {athlete.gender ? ` • ${athlete.gender}` : ""}
            </p>
         </div>
         <Link to={`/athletes/${id}/log`} className="bg-dolphin-gold text-dolphin-blue font-bold px-4 py-2 rounded-md hover:bg-yellow-400 flex items-center shadow-sm">
           <Plus className="w-4 h-4 mr-2" />
           录入新记录
         </Link>
       </div>

       {/* Training Status Card */}
       <div className="bg-white p-6 rounded-lg shadow">
         <div className="flex justify-between items-start mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <UserCog className="w-5 h-5 mr-2 text-blue-600" />
                训练状态跟踪
            </h3>
            <button 
                onClick={openStatusModal}
                className="text-sm text-blue-600 hover:underline flex items-center"
            >
                <Pencil className="w-3 h-3 mr-1" />
                修改状态
            </button>
         </div>
         
         <div className="mb-8">
             <div className="flex items-center gap-3">
                <span className="text-gray-500 text-lg">当前状态：</span>
                <span className={`text-4xl font-bold ${currentStatusConfig.color.replace('bg-', 'text-').replace('-50', '-600')}`}>
                    {currentStatusConfig.label}
                    {statusInfo?.current?.destination && ` · ${statusInfo.current.destination}`}
                </span>
             </div>
             <p className="text-gray-400 text-sm mt-2 ml-1">
                 自 {statusInfo?.current?.start_date} 开始
             </p>
         </div>

         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                 <div className="text-green-800 font-medium mb-1">在训时长</div>
                 <div className="text-2xl font-bold text-green-700">
                     {formatDuration(statusInfo?.summary.training || 0)}
                 </div>
             </div>
             <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                 <div className="text-gray-800 font-medium mb-1">停训时长</div>
                 <div className="text-2xl font-bold text-gray-700">
                     {formatDuration(statusInfo?.summary.paused || 0)}
                 </div>
             </div>
             <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                 <div className="text-orange-800 font-medium mb-1">走训时长</div>
                 <div className="text-2xl font-bold text-orange-700">
                     {formatDuration(statusInfo?.summary.trial || 0)}
                 </div>
             </div>
             <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                 <div className="text-purple-800 font-medium mb-1">输送时长</div>
                 <div className="text-2xl font-bold text-purple-700">
                     {formatDuration(statusInfo?.summary.transferred || 0)}
                 </div>
             </div>
         </div>
       </div>

       {/* Progress Cards */}
       {chartData.strokes.some(s => progressRates[s] !== null) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {chartData.strokes.map(stroke => {
            const rate = progressRates[stroke];
            if (rate === null) return null;
            const isImproved = rate > 0;
            return (
              <div key={stroke} className="bg-white p-4 rounded-lg shadow border border-gray-100">
                <h4 className="text-sm font-medium text-gray-500">{stroke}近期进步率</h4>
                <div className="flex items-baseline mt-1">
                  <span className={`text-2xl font-bold ${isImproved ? 'text-green-600' : 'text-red-500'}`}>
                    {isImproved ? '↑' : '↓'} {Math.abs(rate).toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-400 ml-2">相比上次</span>
                </div>
              </div>
            )
          })}
        </div>
       )}

       {/* Charts Section */}
       <div className="relative">
          <div className="absolute top-0 right-0 z-10">
              <select 
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-white border border-gray-300 rounded text-sm p-1 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">全部记录</option>
                <option value="1m">近1个月</option>
                <option value="3m">近3个月</option>
                <option value="6m">近6个月</option>
                <option value="1y">近1年</option>
              </select>
           </div>
           
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
             <div className="bg-white p-4 rounded-lg shadow">
               <ReactECharts option={lineChartOption} style={{ height: '300px' }} />
             </div>
             <div className="bg-white p-4 rounded-lg shadow">
               <ReactECharts option={barChartOption} style={{ height: '300px' }} />
             </div>
           </div>
       </div>

       {/* Status Section */}
       <div className="bg-white p-6 rounded-lg shadow">
         <div className="flex justify-between items-center mb-4">
            <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-green-600" />
                    状态评分趋势
                </h3>
                <p className="text-sm text-gray-500">
                    该时段平均状态：<span className="font-bold text-green-600">{statusChartData.average}</span>
                </p>
            </div>
         </div>
         <ReactECharts option={statusChartOption} style={{ height: '250px' }} />
       </div>

       {/* History Table */}
       <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col">
         <div className="px-6 py-4 border-b border-gray-200">
           <h3 className="text-lg font-medium text-gray-900">历史记录</h3>
         </div>
         <div className="overflow-x-auto w-full">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">日期</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">训练量 (km)</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">成绩</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.map(log => (
                <tr key={log.id}>
                  <td className="px-4 py-4 whitespace-nowrap text-gray-900 text-sm">{format(new Date(log.date), 'yyyy年MM月dd日')}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-gray-500 text-sm">{log.distance_km}</td>
                  <td className="px-4 py-4 text-gray-500 text-sm">
                    {log.performance_entries?.map(p => (
                      <div key={p.id} className="text-sm py-1">
                        <span className="font-medium text-gray-700">{p.stroke}:</span> {p.time_seconds}s
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-gray-500 text-sm">
                    {log.status_score !== null && log.status_score !== undefined ? (
                        <div className="flex flex-col">
                            <span className={`font-bold ${log.status_score >= 80 ? 'text-green-600' : log.status_score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {log.status_score}
                            </span>
                            {log.status_note && <span className="text-xs text-gray-400 truncate max-w-[100px]" title={log.status_note}>{log.status_note}</span>}
                        </div>
                    ) : (
                        <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openEditModal(log)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      title="编辑"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      className="text-red-600 hover:text-red-900"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">暂无训练记录</td>
                </tr>
              )}
            </tbody>
          </table>
         </div>
       </div>

       {/* Edit Log Modal */}
       {editingLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">编辑训练记录</h2>
              <button onClick={() => setEditingLog(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateLog}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">训练量 (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editDistance}
                    onChange={(e) => setEditDistance(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

               <div className="grid grid-cols-2 gap-4 mb-4 bg-gray-50 p-3 rounded">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">状态评分 (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editStatusScore}
                    onChange={(e) => setEditStatusScore(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="可选"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">状态备注</label>
                  <input
                    type="text"
                    value={editStatusNote}
                    onChange={(e) => setEditStatusNote(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="可选"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">各项成绩</label>
                {editEntries.map((entry, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="泳姿 (如: 100米自由泳)"
                      value={entry.stroke}
                      onChange={(e) => handleEditEntryChange(index, 'stroke', e.target.value)}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="时间 (秒)"
                      value={entry.time}
                      onChange={(e) => handleEditEntryChange(index, 'time', e.target.value)}
                      className="w-24 border border-gray-300 rounded-md px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={() => removeEditEntry(index)}
                      className="text-red-500 hover:text-red-700 px-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEditEntry}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center mt-2"
                >
                  <Plus className="w-4 h-4 mr-1" /> 添加一项成绩
                </button>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-dolphin-gold text-dolphin-blue font-bold rounded-md hover:bg-yellow-400 shadow-sm"
                >
                  保存修改
                </button>
              </div>
            </form>
          </div>
        </div>
       )}

       {/* Venue/Team Edit Modal */}
       {showVenueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-bold mb-4">修改场馆/队伍</h2>
            <form onSubmit={handleUpdateVenue}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">所属场馆</label>
                <select
                  value={venueSelect}
                  onChange={(e) => setVenueSelect(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                >
                  {VENUE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {venueSelect === "其他" && (
                  <input
                    type="text"
                    placeholder="请输入场馆名称"
                    value={venueCustom}
                    onChange={(e) => setVenueCustom(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">所属队伍</label>
                <select
                  value={teamSelect}
                  onChange={(e) => setTeamSelect(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                >
                  {TEAM_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {teamSelect === "其他" && (
                  <input
                    type="text"
                    placeholder="请输入队伍名称"
                    value={teamCustom}
                    onChange={(e) => setTeamCustom(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowVenueModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-dolphin-gold text-dolphin-blue font-bold rounded-md hover:bg-yellow-400 shadow-sm"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Edit Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-bold mb-4">修改训练状态</h2>
            <form onSubmit={handleUpdateStatus}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="training">在训</option>
                  <option value="paused">停训</option>
                  <option value="trial">走训</option>
                  <option value="transferred">输送</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
                <input
                  type="date"
                  required
                  value={statusStartDate}
                  onChange={(e) => setStatusStartDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">结束日期 (可选)</label>
                <input
                  type="date"
                  value={statusEndDate}
                  onChange={(e) => setStatusEndDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {(status === 'transferred' || status === 'trial') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                      {status === 'transferred' ? '输送去向' : '走训去向'}
                  </label>
                  <input
                    type="text"
                    placeholder="如: 省队、国家队"
                    value={transferDest}
                    onChange={(e) => setTransferDest(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-dolphin-gold text-dolphin-blue font-bold rounded-md hover:bg-yellow-400 shadow-sm"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
