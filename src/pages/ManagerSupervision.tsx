import { useState, useEffect, useMemo } from 'react';
import { useCoachProfile } from '../hooks/useCoachProfile';
import { supabase } from '../lib/supabase';
import { format, subDays, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Bar, Line } from 'react-chartjs-2';
import { Search, Filter, Calendar, CheckCircle, AlertCircle, Eye, FileText, ChevronRight } from 'lucide-react';

export default function ManagerSupervision() {
  const { isManager, isAdmin, profile } = useCoachProfile();
  const [activeTab, setActiveTab] = useState<'scores' | 'plans'>('scores');
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [coaches, setCoaches] = useState<any[]>([]);
  const [scoreLogs, setScoreLogs] = useState<any[]>([]);
  const [planLogs, setPlanLogs] = useState<any[]>([]);
  
  // Navigation State
  const [viewState, setViewState] = useState<'list' | 'coach_dates' | 'date_details' | 'coach_plans'>('list');
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [planSearchTerm, setPlanSearchTerm] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [logDetails, setLogDetails] = useState<any>(null);

  // Filters
  const [dateRange, setDateRange] = useState('30d'); // 7d, 30d, 90d, custom
  const [customDays, setCustomDays] = useState(7); // default custom days

  useEffect(() => {
    // Reset view when tab changes
    setViewState('list');
    setSelectedCoachId(null);
    setSelectedDate(null);
  }, [activeTab]);

  useEffect(() => {
    if (isManager || isAdmin) {
      fetchData();
    }
  }, [isManager, isAdmin, dateRange, customDays]); // Re-add this effect for data fetching

  const fetchData = async () => {
    setLoading(true);
    try {
        // 1. Fetch Coaches in Venue
        const { data: coachesData } = await supabase
            .from('coaches')
            .select('id, first_name, last_name, venue')
            .eq('venue', profile?.venue || ''); // Filter by manager's venue
        
        setCoaches(coachesData || []);

        // Calc Date Range
        const endDate = new Date();
        let daysToSub = 30;
        if (dateRange === '7d') daysToSub = 7;
        else if (dateRange === '30d') daysToSub = 30;
        else if (dateRange === '90d') daysToSub = 90;
        else if (dateRange === 'custom') daysToSub = customDays || 7;

        const startDate = subDays(endDate, daysToSub);
        const startStr = startDate.toISOString();

        // 2. Fetch Score Logs (Training Logs with performances)
        const { data: scores } = await supabase
            .from('training_logs')
            .select('id, date, recorder, athlete_id, created_at')
            .gte('date', startStr)
            .order('date', { ascending: false });
        
        setScoreLogs(scores || []);

        // 3. Fetch Training Plans
        const { data: plans } = await supabase
            .from('training_plans')
            .select('id, date, title, coach_id, created_at')
            .gte('date', startStr)
            .order('date', { ascending: false });
            
        setPlanLogs(plans || []);

    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  // --- Aggregation Logic ---
  
  const coachStats = useMemo(() => {
      const stats: Record<string, { name: string, scoreCount: number, planCount: number, lastUpload: string }> = {};
      
      coaches.forEach(c => {
          stats[c.id] = { 
              name: `${c.last_name}${c.first_name}`, 
              scoreCount: 0, 
              planCount: 0, 
              lastUpload: '-' 
          };
      });

      // Map recorder name to coach ID is tricky if recorder is just text name. 
      // Ideally we match by ID if training_logs had coach_id. It doesn't, it has 'recorder' text.
      // So we match by name string.
      
      scoreLogs.forEach(log => {
          const coach = coaches.find(c => `${c.last_name}${c.first_name}` === log.recorder);
          if (coach) {
              stats[coach.id].scoreCount++;
              if (stats[coach.id].lastUpload === '-' || new Date(log.created_at) > new Date(stats[coach.id].lastUpload)) {
                  stats[coach.id].lastUpload = log.created_at;
              }
          }
      });

      planLogs.forEach(plan => {
          if (stats[plan.coach_id]) {
              stats[plan.coach_id].planCount++;
              if (stats[plan.coach_id].lastUpload === '-' || new Date(plan.created_at) > new Date(stats[plan.coach_id].lastUpload)) {
                  stats[plan.coach_id].lastUpload = plan.created_at;
              }
          }
      });

      return Object.values(stats);
  }, [coaches, scoreLogs, planLogs]);

  const fetchLogDetails = async (logId: string) => {
      const { data, error } = await supabase
          .from('performance_entries')
          .select('*')
          .eq('log_id', logId);
      
      if (data) {
          setLogDetails(data);
          setSelectedLogId(logId);
          setShowDetailModal(true);
      }
  };

  const filteredStats = useMemo(() => {
      // Return full stats for list view
      return coachStats; 
  }, [coachStats]);
  
  // Drill Down Helpers
  const getCoachLogs = (coachId: string) => {
      const coach = coaches.find(c => c.id === coachId);
      if (!coach) return [];
      // Match by recorder name for scores
      const name = `${coach.last_name}${coach.first_name}`;
      return scoreLogs.filter(l => l.recorder === name);
  };

  const getCoachPlans = (coachId: string) => {
      return planLogs.filter(p => p.coach_id === coachId);
  };

  const getLogsByDate = (coachId: string, date: string) => {
      const logs = getCoachLogs(coachId);
      return logs.filter(l => l.date === date);
  };
  
  const renderBreadcrumb = () => {
      const coach = coaches.find(c => c.id === selectedCoachId);
      const coachName = coach ? `${coach.last_name}${coach.first_name}` : '未知教练';

      return (
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
            <button onClick={() => setViewState('list')} className="hover:text-blue-600 hover:underline">教练列表</button>
            {viewState !== 'list' && (
                <>
                    <ChevronRight className="w-4 h-4" />
                    <span className={viewState === 'coach_dates' || viewState === 'coach_plans' ? 'font-bold text-gray-900' : ''}>
                        {coachName}的{activeTab === 'scores' ? '成绩' : '计划'}记录
                    </span>
                </>
            )}
            {viewState === 'date_details' && selectedDate && (
                <>
                    <ChevronRight className="w-4 h-4" />
                    <span className="font-bold text-gray-900">{selectedDate}</span>
                </>
            )}
        </div>
      );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Modal */}
      {showDetailModal && logDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowDetailModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg">成绩详情</h3>
                    <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
                </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">泳姿</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">成绩</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">分段</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {logDetails.map((entry: any) => (
                                <tr key={entry.id}>
                                    <td className="px-4 py-2 text-sm">{entry.stroke}</td>
                                    <td className="px-4 py-2 text-sm font-bold text-blue-600">
                                        {/* Convert seconds to time string logic simplified */}
                                        {entry.time_seconds}s
                                    </td>
                                    <td className="px-4 py-2 text-xs text-gray-500">
                                        {entry.split_times?.join(' | ') || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">监管控制台</h1>
        <div className="flex gap-2 items-center">
            {dateRange === 'custom' && (
                <div className="flex items-center gap-2 bg-white border rounded-md px-2 py-1">
                    <span className="text-sm text-gray-500">近</span>
                    <input 
                        type="number" 
                        min="1" 
                        max="3650"
                        value={customDays}
                        onChange={e => setCustomDays(parseInt(e.target.value) || 1)}
                        className="w-16 text-center border-b border-blue-200 focus:border-blue-500 outline-none text-sm font-bold text-blue-600"
                    />
                    <span className="text-sm text-gray-500">天</span>
                </div>
            )}
            <select 
                value={dateRange} 
                onChange={e => setDateRange(e.target.value)}
                className="border rounded-md px-3 py-1.5 text-sm cursor-pointer"
            >
                <option value="7d">近7天</option>
                <option value="30d">近30天</option>
                <option value="90d">近3个月</option>
                <option value="custom">自定义天数</option>
            </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('scores')}
          className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'scores' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          成绩上传监管
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'plans' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          训练计划监管
        </button>
      </div>

      {loading ? (
          <div className="text-center py-20">加载中...</div>
      ) : (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-gray-500 text-sm font-medium">总上传记录数</h3>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                        {activeTab === 'scores' ? scoreLogs.length : planLogs.length}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-gray-500 text-sm font-medium">活跃教练人数</h3>
                    <p className="text-3xl font-bold text-blue-600 mt-2">
                        {coachStats.filter(c => (activeTab === 'scores' ? c.scoreCount : c.planCount) > 0).length}
                        <span className="text-sm text-gray-400 font-normal ml-2">/ {coaches.length}</span>
                    </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-gray-500 text-sm font-medium">今日新增</h3>
                    <p className="text-3xl font-bold text-green-600 mt-2">
                        {(activeTab === 'scores' ? scoreLogs : planLogs).filter(l => isSameDay(new Date(l.created_at), new Date())).length}
                    </p>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">教练上传统计</h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">教练姓名</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">上传数量</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最近上传时间</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">完成率评估</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {coachStats.map((stat, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stat.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {activeTab === 'scores' ? stat.scoreCount : stat.planCount}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {stat.lastUpload !== '-' ? format(new Date(stat.lastUpload), 'yyyy-MM-dd HH:mm') : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {(() => {
                                        const count = activeTab === 'scores' ? stat.scoreCount : stat.planCount;
                                        // Simple logic: > 0 is good for demo
                                        if (count > 5) return <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">优秀</span>;
                                        if (count > 0) return <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">正常</span>;
                                        return <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">未完成</span>;
                                    })()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Detailed Log View */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800">
                        详细记录列表 ({activeTab === 'scores' ? '成绩' : '计划'})
                    </h3>
                    {viewState !== 'list' && renderBreadcrumb()}
                </div>

                {/* --- LIST VIEW: Show Coaches --- */}
                {viewState === 'list' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {coachStats.map((stat, idx) => {
                            const count = activeTab === 'scores' ? stat.scoreCount : stat.planCount;
                            const coachId = coaches.find(c => `${c.last_name}${c.first_name}` === stat.name)?.id;
                            
                            if (!coachId) return null;

                            return (
                                <div 
                                    key={idx} 
                                    onClick={() => {
                                        setSelectedCoachId(coachId);
                                        setViewState(activeTab === 'scores' ? 'coach_dates' : 'coach_plans');
                                    }}
                                    className="border rounded-lg p-4 hover:bg-blue-50 cursor-pointer transition-all flex justify-between items-center group"
                                >
                                    <div>
                                        <h4 className="font-bold text-gray-900">{stat.name}</h4>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {activeTab === 'scores' ? '上传成绩' : '上传计划'}: <span className="font-medium text-blue-600">{count}</span> 条
                                        </p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500" />
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* --- SCORE VIEW: Coach Dates --- */}
                {viewState === 'coach_dates' && selectedCoachId && (
                    <div className="space-y-2">
                        {(() => {
                            const logs = getCoachLogs(selectedCoachId);
                            // Group logs by date
                            const dates = Array.from(new Set(logs.map(l => l.date))).sort().reverse();
                            
                            if (dates.length === 0) return <div className="text-gray-500 text-center py-4">该教练暂无上传记录</div>;

                            return dates.map(date => {
                                const count = logs.filter(l => l.date === date).length;
                                return (
                                    <div 
                                        key={date}
                                        onClick={() => {
                                            setSelectedDate(date);
                                            setViewState('date_details');
                                        }}
                                        className="border rounded p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Calendar className="w-5 h-5 text-gray-400" />
                                            <span className="font-medium text-gray-900">{date}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{count}条记录</span>
                                            <ChevronRight className="w-4 h-4 text-gray-300" />
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                )}

                {/* --- SCORE VIEW: Date Details --- */}
                {viewState === 'date_details' && selectedCoachId && selectedDate && (
                    <div className="space-y-2">
                         {(() => {
                            const logs = getLogsByDate(selectedCoachId, selectedDate);
                            return logs.map((log: any) => (
                                <div key={log.id} className="border rounded p-3 hover:bg-gray-50 transition-colors">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-800">成绩记录</span>
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">已上传</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                运动员ID: {log.athlete_id} · 提交时间: {format(new Date(log.created_at), 'HH:mm')}
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => fetchLogDetails(log.id)}
                                            className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1 bg-blue-50 rounded hover:bg-blue-100"
                                        >
                                            查看详情
                                        </button>
                                    </div>
                                </div>
                            ));
                         })()}
                    </div>
                )}

                {/* --- PLAN VIEW: Coach Plans List with Search --- */}
                {viewState === 'coach_plans' && selectedCoachId && (
                    <div className="space-y-4">
                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input 
                                type="text"
                                placeholder="搜索计划标题..."
                                value={planSearchTerm}
                                onChange={e => setPlanSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        {/* Plans List */}
                        <div className="space-y-2">
                            {(() => {
                                let plans = getCoachPlans(selectedCoachId);
                                if (planSearchTerm) {
                                    plans = plans.filter(p => p.title.toLowerCase().includes(planSearchTerm.toLowerCase()));
                                }
                                
                                if (plans.length === 0) return <div className="text-gray-500 text-center py-4">暂无相关计划</div>;

                                return plans.map((plan: any) => (
                                    <div key={plan.id} className="border rounded p-3 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h4 className="font-bold text-gray-900">{plan.title}</h4>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    日期: {plan.date} · 提交时间: {format(new Date(plan.created_at), 'yyyy-MM-dd HH:mm')}
                                                </p>
                                            </div>
                                            {/* Future: View Plan Detail */}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                )}
            </div>
          </>
      )}
    </div>
  );
}
