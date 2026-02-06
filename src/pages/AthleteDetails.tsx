import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "../lib/supabase";
import { Athlete, TrainingLog, AthleteStatusHistory } from "../types";
import { 
  ArrowLeft, Pencil, TrendingUp, Filter, 
  ChevronDown, ChevronUp, Clock, Info, User, MapPin, Layers, Camera, Upload, X,
  Folder, Printer, Trash2
} from "lucide-react";
import { Line, Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { format, subDays, startOfDay, isAfter, startOfWeek, endOfWeek, getWeek } from "date-fns";
import { zhCN } from 'date-fns/locale';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

const STATUS_CONFIG = {
    training: { label: "在训", color: "bg-[#4CAF50] text-white" },
    paused: { label: "停训", color: "bg-gray-100 text-gray-800" },
    trial: { label: "走训", color: "bg-orange-100 text-orange-800" },
    transferred: { label: "输送", color: "bg-purple-100 text-purple-800" }
};

const TEST_TYPE_COLORS: Record<string, string> = {
    '日常体能测试': 'bg-blue-100 text-blue-800',
    '专项技术测试': 'bg-purple-100 text-purple-800',
    '赛前模拟测试': 'bg-red-100 text-red-800'
};

const formatTime = (seconds: number) => {
    if (!seconds) return '-';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    const centi = Math.round((seconds - Math.floor(seconds)) * 100);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${centi.toString().padStart(2, '0')}`;
};

export default function AthleteDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Status Edit State
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<AthleteStatusHistory['status']>('training');
  
  // Chart & List Controls
  const [chartRange, setChartRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [chartEvent, setChartEvent] = useState('all');
  
  // List Expansion State
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedQuarters, setExpandedQuarters] = useState<Set<string>>(new Set());
  
  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterStroke, setFilterStroke] = useState('all');
  const [filterCoach, setFilterCoach] = useState('all');

  // Avatar Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const CURRENT_YEAR = new Date().getFullYear();

  useEffect(() => {
    if (user && id) {
      fetchData();
    }
  }, [user, id]);

  async function fetchData() {
    if (!id) return;
    setLoading(true);
    
    // 1. Fetch Athlete
    const { data: athleteData, error: athleteError } = await supabase
      .from("athletes")
      .select(`*, athlete_status_history (*)`)
      .eq("id", id)
      .single();

    if (!athleteError && athleteData) {
        const history = athleteData.athlete_status_history as AthleteStatusHistory[];
        const current = history?.find(h => !h.end_date) 
          || history?.sort((a,b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0];
        
        setAthlete({ ...athleteData, current_status: current } as Athlete);
        if (current) setNewStatus(current.status);
    }

    // 2. Fetch Logs
    const { data: logsData, error: logsError } = await supabase
      .from("training_logs")
      .select(`*, performance_entries (*)`)
      .eq("athlete_id", id)
      .order("date", { ascending: false });

    if (!logsError) {
        // Filter out soft-deleted entries
        const cleanLogs = (logsData || []).map(log => ({
            ...log,
            performance_entries: log.performance_entries?.filter((p: any) => !p.deleted_at)
        }));
        setLogs(cleanLogs);
    }
    setLoading(false);
  }

  // --- Chart Data ---
  const chartData = useMemo(() => {
      let start: Date, end: Date;
      
      if (chartRange === 'custom' && customStart && customEnd) {
          start = new Date(customStart);
          end = new Date(customEnd);
      } else {
          end = new Date();
          const days = chartRange === '7d' ? 7 : chartRange === '30d' ? 30 : 90;
          start = subDays(end, days);
      }
      
      // Filter and Sort Ascending for Chart
      const filtered = logs
        .filter(l => {
            const d = new Date(l.date);
            return d >= start && d <= end;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const labels = filtered.map(l => format(new Date(l.date), 'MM-dd'));
      
      const datasets = [];
      
      if (chartEvent === 'all') {
          datasets.push({
              label: '状态评分',
              data: filtered.map(l => l.status_score || 0),
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              fill: true,
              tension: 0.4
          });
      } else {
          datasets.push({
              label: `${chartEvent} (秒)`,
              data: filtered.map(l => {
                  const p = l.performance_entries?.find(e => e.stroke === chartEvent);
                  return p ? p.time_seconds : null;
              }),
              borderColor: 'rgb(249, 115, 22)',
              backgroundColor: 'rgba(249, 115, 22, 0.1)',
              fill: true,
              tension: 0.4,
              spanGaps: true
          });
      }

      return { labels, datasets };
  }, [logs, chartRange, chartEvent, customStart, customEnd]);

  const uniqueStrokes = useMemo(() => {
      const s = new Set<string>();
      logs.forEach(l => l.performance_entries?.forEach(p => s.add(p.stroke)));
      return Array.from(s).sort();
  }, [logs]);

  // Coaches List for Filter
  const uniqueCoaches = useMemo(() => {
      const s = new Set<string>();
      logs.forEach(l => {
          if (l.recorder) s.add(l.recorder);
      });
      return Array.from(s).sort();
  }, [logs]);

  // --- List Data & Grouping ---
  const displayLogs = useMemo(() => {
      return logs.filter(l => {
          if (filterType !== 'all' && l.test_type !== filterType) return false;
          if (filterStroke !== 'all') {
              // Check if any performance entry matches the stroke
              const hasStroke = l.performance_entries?.some(p => p.stroke === filterStroke);
              if (!hasStroke) return false;
          }
          if (filterCoach !== 'all' && l.recorder !== filterCoach) return false;
          return true;
      });
  }, [logs, filterType, filterStroke, filterCoach]);

  const pbMap = useMemo(() => {
      const map: Record<string, number> = {};
      logs.forEach(log => {
          log.performance_entries?.forEach(p => {
              if (!map[p.stroke] || p.time_seconds < map[p.stroke]) {
                  map[p.stroke] = p.time_seconds;
              }
          });
      });
      return map;
  }, [logs]);

  const groupedLogs = useMemo(() => {
      // Structure: "YYYY-MM" -> "W{week}" -> Logs[]
      const groups: Record<string, Record<string, TrainingLog[]>> = {};
      
      displayLogs.forEach(log => {
          if (!log.date) return;
          const date = new Date(log.date);
          const year = date.getFullYear();
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const key = `${year}-${month}`;
          
          const week = getWeek(date, { locale: zhCN });
          const weekKey = `W${week}`;

          if (!groups[key]) groups[key] = {};
          if (!groups[key][weekKey]) groups[key][weekKey] = [];
          
          groups[key][weekKey].push(log);
      });
      return groups;
  }, [displayLogs]);

  // Initialize Default Expanded State
  useEffect(() => {
      const years = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));
      if (years.length > 0) {
          const latestYear = years[0];
          const quarters = Object.keys(groupedLogs[latestYear]).sort((a, b) => b.localeCompare(a));
          if (quarters.length > 0) {
              const latestQuarter = quarters[0];
              setExpandedYears(prev => new Set([...prev, latestYear]));
              setExpandedQuarters(prev => new Set([...prev, latestQuarter]));
          }
      }
  }, [groupedLogs]); // Re-run when groups change (e.g. data load)

  const toggleYear = (year: string) => {
      const newSet = new Set(expandedYears);
      if (newSet.has(year)) newSet.delete(year);
      else newSet.add(year);
      setExpandedYears(newSet);
  };

  const toggleQuarter = (year: string, quarter: string) => {
      // quarter is actually the week key here in new structure
      const newSet = new Set(expandedQuarters);
      if (newSet.has(quarter)) newSet.delete(quarter);
      else newSet.add(quarter);
      setExpandedQuarters(newSet);
  };

  // --- Avatar Upload Handler ---
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // 1. Validate File Type
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
          alert("不支持的文件格式，仅允许 JPG/PNG");
          return;
      }

      // 2. Validate File Size (2MB)
      if (file.size > 2 * 1024 * 1024) {
          alert("图片大小不能超过 2MB");
          return;
      }

      setUploadingAvatar(true);
      
      // 3. Retry Mechanism
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
          try {
              const fileExt = file.name.split('.').pop();
              const fileName = `${id}-${Date.now()}.${fileExt}`;
              const filePath = `${fileName}`;

              // Use standard supabase client which has the auth token if signed in
              const { error: uploadError } = await supabase.storage
                  .from('avatars')
                  .upload(filePath, file, {
                      upsert: true
                  });

              if (uploadError) {
                  console.error(`Upload attempt ${attempts + 1} failed:`, uploadError);
                  throw uploadError;
              }

              const { data: { publicUrl } } = supabase.storage
                  .from('avatars')
                  .getPublicUrl(filePath);
              
              const { error: updateError } = await supabase
                  .from('athletes')
                  .update({ avatar_url: publicUrl } as any)
                  .eq('id', id);

              if (updateError) throw updateError;

              setAthlete(prev => prev ? { ...prev, avatar_url: publicUrl } as any : null);
              // Success
              break; 

          } catch (error: any) {
              attempts++;
              if (attempts >= maxAttempts) {
                  console.error("Avatar upload failed after max retries:", error);
                  let msg = error.message || "未知错误";
                  if (msg.includes("row-level security")) msg = "权限不足，请联系管理员";
                  alert(`头像上传失败 (重试3次无效): ${msg}`);
              } else {
                  // Wait before retry
                  await new Promise(r => setTimeout(r, 1000));
              }
          }
      }
      setUploadingAvatar(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Status Change Handler ---
  const handleStatusChange = async (status: AthleteStatusHistory['status'], custom?: string) => {
    try {
        // We need coach_id. Usually it's the current user.
        // If profile is not loaded yet, we might fail constraint.
        // We can try to get it from useUser() -> publicMetadata or just use auth.uid() if RLS handles it.
        // But the table constraint says 'coach_id' is not null.
        
        // Let's assume the current user is the coach.
        const coachId = user?.id; // Clerk ID. 
        // Note: Our 'coaches' table uses Clerk ID as ID? Yes usually.
        // But we need to be sure.
        
        if (!coachId) {
            alert('无法获取当前教练信息，请重新登录');
            return;
        }

        const { error } = await supabase
            .from('athlete_status_history')
            .insert({
                athlete_id: id,
                status: status,
                custom_status: custom,
                start_date: new Date().toISOString(),
                coach_id: coachId // Added coach_id
            });

        if (error) throw error;

        // Update local state
        setNewStatus(status);
        setIsEditingStatus(false);
        // Refresh data
        fetchData();
        alert('状态更新成功');
    } catch (e: any) {
        console.error(e);
        alert('更新失败: ' + e.message);
    }
  };

  const StatusPopover = () => (
    <div className="absolute top-full mt-2 right-0 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 p-2 animate-in fade-in zoom-in-95 duration-200 print:hidden">
        <div className="space-y-1">
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <button
                    key={key}
                    onClick={() => handleStatusChange(key as any)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50 flex items-center justify-between ${newStatus === key ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
                >
                    <span>{config.label}</span>
                    {newStatus === key && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </button>
            ))}
            {/* Custom Status Input */}
             <div className="border-t border-gray-100 pt-2 mt-2">
                <input 
                    type="text" 
                    placeholder="自定义状态..." 
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleStatusChange('other', e.currentTarget.value);
                        }
                    }}
                />
            </div>
        </div>
    </div>
  );

  const handlePrint = () => {
      window.print();
  };

  const handleDeletePerformance = async (entryId: string) => {
      if(!confirm('确定要删除这条成绩记录吗？')) return;
      
      try {
          // Soft delete
          const { error } = await supabase
              .from('performance_entries')
              .update({ deleted_at: new Date().toISOString() } as any) // Cast to any if type def not updated
              .eq('id', entryId);
          
          if(error) throw error;
          
          alert('删除成功');
          fetchData(); // Refresh
      } catch (e: any) {
          console.error(e);
          alert('删除失败: ' + e.message);
      }
  };

  if (loading) return <div className="p-8 text-center">加载中...</div>;
  // if (!athlete) return <div className="p-8 text-center text-red-500">未找到运动员信息</div>; 
  // Allow rendering even if athlete is partial/null with optional chaining, but statusInfo depends on it.
  
  const statusInfo = STATUS_CONFIG[athlete?.current_status?.status || 'training'];

  return (
    <div className="space-y-6 pb-20 print:p-0 print:pb-0">
      <style>
          {`
            @media print {
              .print\\:hidden { display: none !important; }
              body { background: white; }
              .shadow-sm { box-shadow: none !important; border: 1px solid #eee; }
            }
          `}
      </style>
      
      {/* 1. Top Info Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                  {/* Avatar Section */}
                  <div className="relative group cursor-pointer flex-shrink-0">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 border-gray-100 bg-gray-50 flex items-center justify-center" onClick={() => fileInputRef.current?.click()}>
                          {(athlete as any)?.avatar_url ? (
                              <img src={(athlete as any).avatar_url} alt={athlete?.name} className="w-full h-full object-cover" />
                          ) : (
                              <User className="w-7 h-7 sm:w-8 sm:h-8 text-gray-400" />
                          )}
                      </div>
                      <div className="absolute inset-0 bg-black bg-opacity-40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none print:hidden">
                          <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/png, image/jpeg"
                          onChange={handleAvatarUpload}
                      />
                      {uploadingAvatar && (
                          <div className="absolute inset-0 bg-white bg-opacity-80 rounded-lg flex items-center justify-center">
                              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                      )}
                  </div>
                  
                  <div>
                      <div className="flex items-center gap-3 mb-1">
                          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{athlete?.name}</h1>
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${statusInfo?.color}`}>
                              {athlete?.current_status?.status === 'other' ? athlete?.current_status?.custom_status : statusInfo?.label}
                          </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-500">
                          <span>{athlete?.gender === 'M' ? '男' : '女'}</span>
                          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                          <span>{athlete?.birth_year ? `${CURRENT_YEAR - athlete.birth_year}岁` : '-'}</span>
                          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                          <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {athlete?.venue || '未分配'} · {athlete?.team || '未分组'}
                          </span>
                      </div>
                  </div>
              </div>
              <div className="flex gap-3 w-full md:w-auto mt-2 md:mt-0 relative print:hidden">
                  <button 
                      onClick={handlePrint}
                      className="px-3 py-2 border border-[#ccc] rounded-lg bg-white text-gray-600 hover:bg-gray-50 font-medium transition-colors text-sm flex items-center gap-2"
                  >
                      <Printer className="w-4 h-4" />
                      导出报告
                  </button>

                  <button 
                      onClick={() => setIsEditingStatus(!isEditingStatus)}
                      className="flex-1 md:flex-none px-3 py-2 border border-[#ccc] rounded-lg bg-white text-gray-600 hover:bg-gray-50 font-medium transition-colors text-sm"
                  >变更状态</button>
                  
                  {isEditingStatus && <StatusPopover />}

                  <Link 
                      to={`/athletes/${id}/log`}
                      className="flex-1 md:flex-none px-3 py-2 bg-[#1890ff] text-white rounded-lg hover:bg-blue-600 font-medium flex items-center justify-center gap-2 shadow-sm transition-colors text-sm"
                  >
                      <Pencil className="w-4 h-4" />
                      添加测试成绩
                  </Link>
              </div>
          </div>
      </div>

      {/* 2. Trend Chart (Enhanced) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  测试成绩趋势
              </h3>
              <div className="flex flex-wrap items-center gap-4 print:hidden">
                  <select 
                      value={chartEvent}
                      onChange={e => setChartEvent(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                      <option value="all">状态评分趋势</option>
                      {uniqueStrokes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  
                  <div className="flex items-center bg-gray-100 rounded-lg p-1">
                      {(['7d', '30d', '90d'] as const).map(r => (
                          <button
                              key={r}
                              onClick={() => { setChartRange(r); setCustomStart(''); setCustomEnd(''); }}
                              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${chartRange === r ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                          >
                              {r === '7d' ? '近7天' : r === '30d' ? '近30天' : '近3个月'}
                          </button>
                      ))}
                      <button
                          onClick={() => setChartRange('custom')}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${chartRange === 'custom' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                      >
                          自定义
                      </button>
                  </div>
                  
                  {chartRange === 'custom' && (
                      <div className="flex items-center gap-2 text-sm animate-fade-in">
                          <input 
                              type="date" 
                              value={customStart}
                              onChange={e => setCustomStart(e.target.value)}
                              className="border border-gray-200 rounded px-2 py-1 text-xs"
                          />
                          <span className="text-gray-400">-</span>
                          <input 
                              type="date" 
                              value={customEnd}
                              min={customStart}
                              onChange={e => setCustomEnd(e.target.value)}
                              className="border border-gray-200 rounded px-2 py-1 text-xs"
                          />
                      </div>
                  )}
              </div>
          </div>
          <div className="h-72 w-full relative">
              {loading && (
                  <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-10">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
              )}
              <Line data={chartData} options={{ maintainAspectRatio: false, responsive: true }} />
          </div>
      </div>

      {/* 3. Historical List (Grouped) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap justify-between items-center gap-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-500" />
                  历史测试记录
              </h3>
              
              <div className="flex flex-wrap items-center gap-4 print:hidden">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Filter className="w-4 h-4" />
                      <span>筛选:</span>
                  </div>
                  
                  {/* Test Type Filter */}
                  <select 
                      value={filterType}
                      onChange={e => setFilterType(e.target.value)}
                      className="border-none bg-gray-50 rounded-lg px-3 py-1.5 text-sm outline-none cursor-pointer hover:bg-gray-100"
                  >
                      <option value="all">所有类型</option>
                      <option value="日常体能测试">日常体能</option>
                      <option value="专项技术测试">专项技术</option>
                      <option value="赛前模拟测试">赛前模拟</option>
                  </select>

                  {/* Stroke Filter */}
                  <select
                      value={filterStroke}
                      onChange={e => setFilterStroke(e.target.value)}
                      className="border-none bg-gray-50 rounded-lg px-3 py-1.5 text-sm outline-none cursor-pointer hover:bg-gray-100"
                  >
                      <option value="all">所有泳姿</option>
                      {uniqueStrokes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>

                   {/* Coach Filter */}
                   <select
                      value={filterCoach}
                      onChange={e => setFilterCoach(e.target.value)}
                      className="border-none bg-gray-50 rounded-lg px-3 py-1.5 text-sm outline-none cursor-pointer hover:bg-gray-100"
                  >
                      <option value="all">所有记录人</option>
                      {uniqueCoaches.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
              </div>
          </div>

          <div className="p-4 space-y-4">
              {Object.keys(groupedLogs).sort((a,b) => b.localeCompare(a)).map(monthKey => {
                  const [year, month] = monthKey.split('-');
                  const isMonthExpanded = expandedYears.has(monthKey); // Reusing state

                  return (
                  <div key={monthKey} className="border border-gray-200 rounded-lg overflow-hidden break-inside-avoid">
                      {/* Month Header */}
                      <div 
                          className="bg-gray-50 px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => toggleYear(monthKey)}
                      >
                          {isMonthExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronUp className="w-5 h-5 text-gray-500" />}
                          <Folder className="w-5 h-5 text-blue-600" />
                          <span className="font-bold text-gray-800">{year}年 {month}月</span>
                          <span className="text-xs text-gray-500 ml-auto">
                             {Object.values(groupedLogs[monthKey]).reduce((acc, w) => acc + w.length, 0)} 条记录
                          </span>
                      </div>

                      {/* Weeks List */}
                      {isMonthExpanded && (
                          <div className="bg-white p-2 space-y-2">
                              {Object.keys(groupedLogs[monthKey]).sort().map(weekKey => {
                                  const weekLogs = groupedLogs[monthKey][weekKey];
                                  const isWeekExpanded = expandedQuarters.has(weekKey); // Reusing state
                                  
                                  // Calc week range
                                  const firstDate = new Date(weekLogs[0].date);
                                  const start = startOfWeek(firstDate, { locale: zhCN });
                                  const end = endOfWeek(firstDate, { locale: zhCN });

                                  return (
                                  <div key={weekKey} className="border rounded-md">
                                      {/* Week Header */}
                                      <div 
                                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-blue-50 transition-colors"
                                          onClick={() => toggleQuarter('', weekKey)}
                                      >
                                          <span className="font-medium text-sm text-gray-600">
                                              第 {weekKey.split('W')[1]} 周 ({format(start, 'MM.dd')} - {format(end, 'MM.dd')})
                                          </span>
                                          <div className="flex items-center gap-2">
                                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                                  {weekLogs.length} 条
                                              </span>
                                              {isWeekExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                          </div>
                                      </div>

                                      {/* Logs List */}
                                      {isWeekExpanded && (
                                          <div className="divide-y border-t bg-gray-50/50">
                                              {weekLogs.map(log => {
                                                  const isExpanded = expandedLogId === log.id;
                                                  return (
                                                      <div id={`log-${log.id}`} key={log.id} className={`bg-white hover:bg-white hover:shadow-sm transition-all break-inside-avoid ${expandedLogId === log.id ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}>
                                                          {/* Log Summary */}
                                                          <div 
                                                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                                              className="p-3 cursor-pointer flex flex-col sm:flex-row sm:items-center gap-3"
                                                          >
                                                              <div className="flex items-center gap-3 flex-1">
                                                                  <div className="flex flex-col items-center justify-center bg-blue-50 text-blue-700 rounded px-2 py-1 w-12 flex-shrink-0">
                                                                      <span className="text-sm font-bold">{format(new Date(log.date), 'dd')}日</span>
                                                                  </div>
                                                                  <div>
                                                                      <div className="flex items-center gap-2">
                                                                          <span className="text-sm font-bold text-gray-900">
                                                                              {log.performance_entries?.[0]?.stroke || '综合测试'}
                                                                          </span>
                                                                          <span className={`text-xs px-1.5 py-0.5 rounded ${TEST_TYPE_COLORS[log.test_type || '日常体能测试']}`}>
                                                                              {log.test_type}
                                                                          </span>
                                                                      </div>
                                                                      <div className="text-xs text-gray-500 mt-0.5">
                                                                          {log.pool_info || '无场地信息'} · 状态分: {log.status_score || '-'}
                                                                           {log.recorder && ` · ${log.recorder}`}
                                                                      </div>
                                                                  </div>
                                                              </div>
                                                              
                                                              <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0">
                                                                  <div className="text-right">
                                                                      {log.performance_entries?.[0] ? (
                                                                          <span className="font-mono text-lg font-bold text-blue-600">
                                                                              {formatTime(log.performance_entries[0].time_seconds)}
                                                                          </span>
                                                                      ) : (
                                                                          <span className="text-xs text-gray-400">无成绩</span>
                                                                      )}
                                                                  </div>
                                                                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                              </div>
                                                          </div>

                                                          {/* Expanded Detail */}
                                                          {isExpanded && (
                                                              <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                                                                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                                      {/* Detail Table */}
                                                                      <div className="lg:col-span-2 space-y-3">
                                                                          <div className="flex items-center justify-between text-xs">
                                                                              <span className="font-bold text-gray-500">分段成绩</span>
                                                                              <div className="flex items-center gap-2">
                                                                                  <span className="font-bold text-yellow-600">RPE: {log.rpe || '-'}</span>
                                                                              </div>
                                                                          </div>
                                                                          <div className="bg-white border border-gray-200 rounded overflow-hidden">
                                                                              {log.performance_entries?.map((p, idx) => (
                                                                                  <div key={idx} className="flex justify-between items-center px-3 py-2 border-b border-gray-100 last:border-0 text-sm group/entry">
                                                                                      <div className="flex items-center gap-2">
                                                                                          <span className="text-gray-700">{p.stroke}</span>
                                                                                          {pbMap[p.stroke] === p.time_seconds && (
                                                                                              <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1 rounded border border-yellow-200 font-bold">PB</span>
                                                                                          )}
                                                                                      </div>
                                                                                      <div className="flex items-center gap-3">
                                                                                          <span className="font-mono font-bold text-blue-600">{formatTime(p.time_seconds)}</span>
                                                                                          <button 
                                                                                              onClick={() => handleDeletePerformance(p.id)}
                                                                                              className="text-gray-300 hover:text-red-500 opacity-0 group-hover/entry:opacity-100 transition-opacity"
                                                                                              title="删除"
                                                                                          >
                                                                                              <Trash2 className="w-4 h-4" />
                                                                                          </button>
                                                                                      </div>
                                                                                  </div>
                                                                              ))}
                                                                          </div>
                                                                          {log.status_note && (
                                                                              <div className="bg-yellow-50 p-2 rounded border border-yellow-100 text-xs text-yellow-800">
                                                                                  备注: {log.status_note}
                                                                              </div>
                                                                          )}
                                                                      </div>
                                                                      
                                                                      {/* Radar Placeholder or other info */}
                                                                      <div className="flex flex-col items-center justify-center text-xs text-gray-400">
                                                                          {/* Future Chart */}
                                                                      </div>
                                                                  </div>
                                                              </div>
                                                          )}
                                                      </div>
                                                  );
                                              })}
                                          </div>
                                      )}
                                  </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
                  );
              })}
              
              {displayLogs.length === 0 && (
                  <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                      暂无历史记录
                  </div>
              )}
          </div>
      </div>
    </div>
  );
}
