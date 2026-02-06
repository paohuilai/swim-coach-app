import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus, Trash2, User, ChevronDown, ChevronUp, Pencil, TrendingUp, Upload, FileSpreadsheet } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "../lib/supabase";
import { Athlete, AthleteStatusHistory } from "../types";
import { subDays, format } from "date-fns";
import { useCoachProfile } from "../hooks/useCoachProfile";
import { read, utils } from 'xlsx';
import { parseSwimTime } from "../lib/terminology";
import { useAuditLog } from "../hooks/useAuditLog";

const VENUE_OPTIONS = ["东山馆", "莘塍馆", "海城馆", "塘下馆", "开元馆", "飞云馆", "其他"];
const TEAM_OPTIONS = ["一队", "二队", "三队", "四队", "五队", "其他"];

const STATUS_CONFIG = {
  training: { label: "在训", color: "bg-green-100 text-green-800" },
  paused: { label: "停训", color: "bg-gray-100 text-gray-800" },
  trial: { label: "走训", color: "bg-orange-100 text-orange-800" },
  transferred: { label: "输送", color: "bg-purple-100 text-purple-800" }
};

export default function AthletesList() {
  const { user } = useUser();
  const { profile, isAdmin, isManager } = useCoachProfile();
  const { logAction } = useAuditLog();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null);
  
  // Quick Edit State
  const [quickEditAthlete, setQuickEditAthlete] = useState<Athlete | null>(null);
  const [quickEditStatusAthlete, setQuickEditStatusAthlete] = useState<Athlete | null>(null);
  const [showQuickEntryModal, setShowQuickEntryModal] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState("男");
  
  const [venueSelect, setVenueSelect] = useState(VENUE_OPTIONS[0]);
  const [venueCustom, setVenueCustom] = useState("");

  const [teamSelect, setTeamSelect] = useState(TEAM_OPTIONS[0]);
  const [teamCustom, setTeamCustom] = useState("");
  
  // Status Form State
  const [status, setStatus] = useState<AthleteStatusHistory['status']>('training');
  const [statusStartDate, setStatusStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferDest, setTransferDest] = useState("");

  // Grouping & Search State
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Admin Filters
  const [adminVenueFilter, setAdminVenueFilter] = useState("全部");

  // Excel Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const CURRENT_YEAR = new Date().getFullYear();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'quick_entry') {
      setShowQuickEntryModal(true);
    }
  }, [location.search]);

  useEffect(() => {
    if (user && profile) {
      fetchAthletes();
    }
  }, [user, profile, adminVenueFilter]); // Reload if admin filter changes

  async function fetchAthletes() {
    if (!user) return;
    setLoading(true);
    
    // Build Query based on Permissions
    let query = supabase
      .from("athletes")
      .select(`
        *,
        athlete_status_history (
          *
        )
      `)
      .order("created_at", { ascending: false });

    // Apply Permission Filters
    if (isAdmin) {
      // Admin sees all. Apply optional venue filter.
      if (adminVenueFilter !== "全部") {
        query = query.eq("venue", adminVenueFilter);
      }
    } else if (isManager) {
      // Manager sees all in their venue
      if (profile?.venue) {
        query = query.eq("venue", profile.venue);
      } else {
        // Fallback if venue not set (shouldn't happen for manager)
        query = query.eq("coach_id", user.id); 
      }
    } else {
      // Coach sees own athletes
      query = query.eq("coach_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching athletes:", error);
    } else {
      // Map current status
      const processedData = (data || []).map((a: any) => {
        const history = a.athlete_status_history as AthleteStatusHistory[];
        // Find active status (end_date is null) or the latest one
        const current = history?.find(h => !h.end_date) 
          || history?.sort((a,b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0];
          
        return {
          ...a,
          current_status: current
        } as Athlete;
      });

      setAthletes(processedData);
      
      // Initialize with all groups expanded
      if (processedData.length > 0 && expandedGroups.length === 0) {
        const groups = new Set<string>();
        processedData.forEach((a: Athlete) => {
            const by = a.birth_year;
            const g = a.gender || "未知";
            const v = a.venue ? `-${a.venue}` : "";
            // Use simplified grouping for initial expand if list is huge? No, expand all.
            if (by) {
                groups.add(`${by}年${g}组${v}`);
            } else {
                groups.add("未分组");
            }
        });
        setExpandedGroups(Array.from(groups));
      }
    }
    setLoading(false);
  }

  // Filter athletes based on search
  const filteredAthletes = useMemo(() => {
    if (!searchQuery.trim()) return athletes;
    return athletes.filter(a => a.name.includes(searchQuery.trim()));
  }, [athletes, searchQuery]);

  // Group athletes by Birth Year + Gender + Venue
  const groupedAthletes = useMemo(() => {
    const groups: Record<string, Athlete[]> = {};
    
    filteredAthletes.forEach(athlete => {
      let key = "未分组";
      if (athlete.birth_year) {
          const g = athlete.gender || "未知";
          const v = athlete.venue ? `-${athlete.venue}` : "";
          key = `${athlete.birth_year}年${g}组${v}`;
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(athlete);
    });
    
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === "未分组") return 1;
      if (b === "未分组") return -1;
      
      const yearA = parseInt(a);
      const yearB = parseInt(b);
      
      if (yearA !== yearB) return yearB - yearA; 
      return a.localeCompare(b);
    });
    
    return sortedKeys.map(key => ({
      title: key,
      items: groups[key]
    }));
  }, [filteredAthletes]);

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const toggleAll = (expand: boolean) => {
    if (expand) {
      setExpandedGroups(groupedAthletes.map(g => g.title));
    } else {
      setExpandedGroups([]);
    }
  };

  function openAddModal() {
    setEditingAthlete(null);
    setName("");
    setBirthYear("");
    setGender("男");
    setVenueSelect(VENUE_OPTIONS[0]);
    setVenueCustom("");
    setTeamSelect(TEAM_OPTIONS[0]);
    setTeamCustom("");
    setStatus('training');
    setStatusStartDate(new Date().toISOString().split('T')[0]);
    setTransferDest("");
    setShowModal(true);
  }

  function openEditModal(athlete: Athlete) {
    setEditingAthlete(athlete);
    setName(athlete.name);
    setBirthYear(athlete.birth_year?.toString() || "");
    setGender(athlete.gender || "男");
    
    const currentVenue = athlete.venue || "";
    if (VENUE_OPTIONS.includes(currentVenue)) {
      setVenueSelect(currentVenue);
      setVenueCustom("");
    } else {
      setVenueSelect("其他");
      setVenueCustom(currentVenue);
    }

    const currentTeam = athlete.team || "";
    if (TEAM_OPTIONS.includes(currentTeam)) {
      setTeamSelect(currentTeam);
      setTeamCustom("");
    } else {
      setTeamSelect("其他");
      setTeamCustom(currentTeam);
    }
    
    const cur = athlete.current_status;
    setStatus(cur?.status || 'training');
    setStatusStartDate(cur?.start_date || new Date().toISOString().split('T')[0]);
    setTransferDest(cur?.destination || "");
    
    setShowModal(true);
  }

  function openQuickEdit(athlete: Athlete) {
    setQuickEditAthlete(athlete);
    const currentVenue = athlete.venue || "";
    if (VENUE_OPTIONS.includes(currentVenue)) {
      setVenueSelect(currentVenue);
      setVenueCustom("");
    } else {
      setVenueSelect("其他");
      setVenueCustom(currentVenue);
    }

    const currentTeam = athlete.team || "";
    if (TEAM_OPTIONS.includes(currentTeam)) {
      setTeamSelect(currentTeam);
      setTeamCustom("");
    } else {
      setTeamSelect("其他");
      setTeamCustom(currentTeam);
    }
  }

  function openQuickStatusEdit(athlete: Athlete) {
    setQuickEditStatusAthlete(athlete);
    const cur = athlete.current_status;
    setStatus(cur?.status || 'training');
    setStatusStartDate(cur?.start_date || new Date().toISOString().split('T')[0]);
    setTransferDest(cur?.destination || "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name) return;

    const finalVenue = venueSelect === "其他" ? venueCustom : venueSelect;
    const finalTeam = teamSelect === "其他" ? teamCustom : teamSelect;
    const finalBirthYear = birthYear ? parseInt(birthYear) : null;

    if (editingAthlete) {
      // 1. Update basic info
      const { error } = await supabase.from("athletes").update({
        name,
        birth_year: finalBirthYear,
        gender,
        venue: finalVenue,
        team: finalTeam
      }).eq("id", editingAthlete.id);

      if (error) {
        alert("更新运动员失败: " + error.message);
        return;
      }

      // 2. Check if status changed
      const currentStatus = editingAthlete.current_status;
      
      if (currentStatus?.status !== status) {
          if (currentStatus) {
              const newStart = new Date(statusStartDate);
              const endDate = subDays(newStart, 1);
              
              await supabase.from("athlete_status_history")
                  .update({ end_date: format(endDate, 'yyyy-MM-dd') })
                  .eq("id", currentStatus.id);
          }
          
          await supabase.from("athlete_status_history").insert({
              athlete_id: editingAthlete.id,
              status,
              start_date: statusStartDate,
              destination: (status === 'transferred' || status === 'trial') ? transferDest : null
          });
      } else {
          if (currentStatus) {
             await supabase.from("athlete_status_history")
                .update({
                    start_date: statusStartDate,
                    destination: (status === 'transferred' || status === 'trial') ? transferDest : null
                })
                .eq("id", currentStatus.id);
          } else {
              await supabase.from("athlete_status_history").insert({
                athlete_id: editingAthlete.id,
                status,
                start_date: statusStartDate,
                destination: (status === 'transferred' || status === 'trial') ? transferDest : null
            });
          }
      }

      setShowModal(false);
      fetchAthletes();

    } else {
      // Create Athlete
      const { data: newAthlete, error } = await supabase.from("athletes").insert([
        {
          coach_id: user.id,
          name,
          birth_year: finalBirthYear,
          gender,
          venue: finalVenue,
          team: finalTeam
        },
      ]).select().single();

      if (error) {
        alert("添加运动员失败: " + error.message);
      } else if (newAthlete) {
        await supabase.from("athlete_status_history").insert({
            athlete_id: newAthlete.id,
            status, 
            start_date: statusStartDate,
            destination: (status === 'transferred' || status === 'trial') ? transferDest : null
        });

        setShowModal(false);
        fetchAthletes();
      }
    }
  }

  async function handleQuickEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quickEditAthlete) return;

    const finalVenue = venueSelect === "其他" ? venueCustom : venueSelect;
    const finalTeam = teamSelect === "其他" ? teamCustom : teamSelect;

    const { error } = await supabase.from("athletes").update({
      venue: finalVenue,
      team: finalTeam
    }).eq("id", quickEditAthlete.id);

    if (error) {
      alert("更新场馆/队伍失败: " + error.message);
    } else {
      setQuickEditAthlete(null);
      fetchAthletes();
    }
  }

  async function handleQuickStatusSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quickEditStatusAthlete) return;

    const currentStatus = quickEditStatusAthlete.current_status;
      
    if (currentStatus?.status !== status) {
        if (currentStatus) {
            const newStart = new Date(statusStartDate);
            const endDate = subDays(newStart, 1);
            
            await supabase.from("athlete_status_history")
                .update({ end_date: format(endDate, 'yyyy-MM-dd') })
                .eq("id", currentStatus.id);
        }
        
        await supabase.from("athlete_status_history").insert({
            athlete_id: quickEditStatusAthlete.id,
            status,
            start_date: statusStartDate,
            destination: (status === 'transferred' || status === 'trial') ? transferDest : null,
            coach_id: user?.id
        });
    } else {
        if (currentStatus) {
            await supabase.from("athlete_status_history")
              .update({
                  start_date: statusStartDate,
                  destination: (status === 'transferred' || status === 'trial') ? transferDest : null
              })
              .eq("id", currentStatus.id);
        } else {
            await supabase.from("athlete_status_history").insert({
              athlete_id: quickEditStatusAthlete.id,
              status,
              start_date: statusStartDate,
              destination: (status === 'transferred' || status === 'trial') ? transferDest : null,
              coach_id: user?.id
          });
        }
    }

    setQuickEditStatusAthlete(null);
    fetchAthletes();
  }

  async function handleDelete(id: string) {
    if (!confirm("确定要删除这位运动员吗？")) return;

    const { error } = await supabase.from("athletes").delete().eq("id", id);
    if (error) {
      alert("删除运动员失败");
    } else {
      logAction('delete_athlete', 'athlete', id, {});
      fetchAthletes();
    }
  }

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;

      setImporting(true);
      try {
          const data = await file.arrayBuffer();
          const workbook = read(data);
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData: any[] = utils.sheet_to_json(worksheet);

          console.log("Imported Data:", jsonData);

          let successCount = 0;
          let failCount = 0;

          // Process each row
          // Expected Headers: 姓名, 日期, 泳姿, 成绩, 泳池, 记录人, RPE, 划频, 划幅, 备注
          for (const row of jsonData) {
              const name = row['姓名'];
              if (!name) continue;

              // Find athlete
              const athlete = athletes.find(a => a.name === name);
              if (!athlete) {
                  console.warn(`Athlete not found: ${name}`);
                  failCount++;
                  continue;
              }

              const dateStr = row['日期'] ? format(new Date(row['日期']), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
              const stroke = row['泳姿'] || '自由泳';
              const timeStr = row['成绩']; // Can be string or number
              const timeSeconds = parseSwimTime(timeStr);
              const poolInfo = row['泳池'] || '25米池';
              const recorder = row['记录人'] || user?.fullName || '批量导入';

              if (timeSeconds <= 0) {
                  console.warn(`Invalid time for ${name}: ${timeStr}`);
                  failCount++;
                  continue;
              }

              // Create Log
              const { data: log, error: logError } = await supabase.from('training_logs').insert({
                  athlete_id: athlete.id,
                  coach_id: user?.id,
                  date: dateStr,
                  pool_info: poolInfo,
                  recorder: recorder,
                  test_type: '批量导入',
                  rpe: row['RPE'] ? String(row['RPE']) : '3',
                  stroke_rate: row['划频'] ? String(row['划频']) : null,
                  stroke_length: row['划幅'] ? String(row['划幅']) : null,
                  status_note: row['备注'] || '批量导入'
              }).select().single();

              if (logError || !log) {
                  console.error("Log creation failed:", logError);
                  failCount++;
                  continue;
              }

              // Create Entry
              const { error: entryError } = await supabase.from('performance_entries').insert({
                  log_id: log.id,
                  stroke,
                  time_seconds: timeSeconds,
                  timing_method: 'manual'
              });

              if (entryError) {
                  console.error("Entry creation failed:", entryError);
                  failCount++;
              } else {
                  successCount++;
              }
          }

          alert(`导入完成！成功: ${successCount} 条, 失败: ${failCount} 条`);
          
      } catch (err: any) {
          console.error("Import Error:", err);
          alert("导入失败: " + err.message);
      } finally {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  }

  function downloadTemplate() {
      const headers = ['姓名', '日期', '泳姿', '成绩', '泳池', '记录人', 'RPE', '划频', '划幅', '备注'];
      const example = ['张三', format(new Date(), 'yyyy-MM-dd'), '50米自由泳', '00:25.50', '50米池', '王教练', '5', '45', '1.2', '测试数据'];
      
      const ws = utils.aoa_to_sheet([headers, example]);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "测试成绩模板");
      // Add column widths
      ws['!cols'] = [{wch:10}, {wch:12}, {wch:12}, {wch:10}, {wch:10}, {wch:10}, {wch:5}, {wch:8}, {wch:8}, {wch:20}];
      
      // Trigger download
      import('xlsx').then(XLSX => {
         XLSX.writeFile(wb, "批量导入模板.xlsx");
      });
  }

  function getBadgeLabel(venue?: string | null, team?: string | null) {
    if (!venue) return "无场馆";
    if (team) return `${venue}-${team}`;
    return venue;
  }

  function getAge(by: number | null) {
      if (!by) return "-";
      return CURRENT_YEAR - by;
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            运动员管理
            {isAdmin && <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">总管视图</span>}
            {isManager && !isAdmin && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">馆长视图</span>}
        </h1>
        
        <div className="flex flex-1 w-full md:w-auto items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-gray-400" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="搜索运动员姓名..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            
            {/* Admin Venue Filter */}
            {isAdmin && (
                 <select
                 value={adminVenueFilter}
                 onChange={(e) => setAdminVenueFilter(e.target.value)}
                 className="block w-32 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
               >
                 <option value="全部">全部场馆</option>
                 {VENUE_OPTIONS.filter(v => v !== "其他").map(v => (
                   <option key={v} value={v}>{v}</option>
                 ))}
               </select>
            )}
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-end">
           <button 
             onClick={() => toggleAll(true)}
             className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap"
           >
             展开
           </button>
           <span className="text-gray-300">|</span>
           <button 
             onClick={() => toggleAll(false)}
             className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap"
           >
             收起
           </button>
           
           {/* Excel Import Button */}
           <div className="relative">
               <input 
                   type="file" 
                   ref={fileInputRef} 
                   className="hidden" 
                   accept=".xlsx, .xls" 
                   onChange={handleExcelImport} 
                   disabled={importing}
               />
               <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="ml-4 bg-green-600 text-white font-bold px-4 py-2 rounded-md hover:bg-green-700 flex items-center shadow-sm whitespace-nowrap disabled:opacity-50"
                    title="支持列: 姓名, 日期, 泳姿, 成绩, RPE, 划频, 划幅, 备注"
                >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    {importing ? "导入中..." : "批量导入"}
                </button>
           </div>

           <button
            onClick={openAddModal}
            className="ml-2 bg-dolphin-gold text-dolphin-blue font-bold px-4 py-2 rounded-md hover:bg-yellow-400 flex items-center shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2" />
            添加
          </button>
        </div>
      </div>

      {athletes.length === 0 && !loading ? (
        <div className="bg-white shadow rounded-lg p-12 text-center text-gray-500">
          暂无运动员，请点击右上角添加。
        </div>
      ) : (
        <div className="space-y-4">
          {groupedAthletes.map(group => {
            const isExpanded = expandedGroups.includes(group.title);
            return (
              <div key={group.title} className="bg-white shadow rounded-lg overflow-hidden">
                <button 
                  onClick={() => toggleGroup(group.title)}
                  className="w-full px-6 py-4 bg-gray-50 flex justify-between items-center hover:bg-gray-100 transition-colors"
                >
                  <h3 className="font-bold text-gray-700 flex items-center">
                    {group.title}
                    <span className="ml-2 text-xs font-normal text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                      {group.items.length}人
                    </span>
                  </h3>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                
                {isExpanded && (
                  <div className="border-t border-gray-200 overflow-x-auto w-full">
                     <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">姓名</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">出生年份 (年龄)</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">性别</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {group.items.map((athlete) => {
                          const statusKey = athlete.current_status?.status || 'training';
                          const statusInfo = STATUS_CONFIG[statusKey];
                          const destination = athlete.current_status?.destination;

                          return (
                            <tr key={athlete.id} className="hover:bg-gray-50">
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <Link to={`/athletes/${athlete.id}`} className="text-blue-600 hover:underline font-medium flex items-center text-sm">
                                    <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 mr-2 flex-shrink-0 flex items-center justify-center border border-gray-200">
                                        {athlete.avatar_url ? (
                                            <img src={athlete.avatar_url} alt={athlete.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-3.5 h-3.5 text-gray-400" />
                                        )}
                                    </div>
                                    {athlete.name}
                                  </Link>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openQuickEdit(athlete);
                                    }}
                                    className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium hover:bg-opacity-80 cursor-pointer ${
                                      athlete.venue 
                                        ? "bg-blue-100 text-blue-800 hover:bg-blue-200" 
                                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                    }`}
                                    title="点击修改场馆/队伍"
                                  >
                                    [{getBadgeLabel(athlete.venue, athlete.team)}]
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openQuickStatusEdit(athlete);
                                    }}
                                    className={`ml-2 px-2 py-0.5 rounded text-xs font-medium cursor-pointer hover:opacity-80 ${statusInfo.color}`}
                                    title="点击修改训练状态"
                                  >
                                    [{statusInfo.label}]
                                    {destination && `·${destination}`}
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-gray-500 text-sm">
                                  {athlete.birth_year ? (
                                      <span>
                                          {athlete.birth_year}年
                                          <span className="text-xs text-gray-400 ml-1">(当前{getAge(athlete.birth_year)}岁)</span>
                                      </span>
                                  ) : "-"}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-gray-500 text-sm">{athlete.gender || "-"}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end gap-2">
                                  <Link
                                    to={`/athletes/${athlete.id}/log`}
                                    className="text-green-600 hover:text-green-900"
                                    title="录入成绩"
                                  >
                                    <TrendingUp className="w-4 h-4" />
                                  </Link>
                                  <button
                                    onClick={() => openEditModal(athlete)}
                                    className="text-blue-600 hover:text-blue-900"
                                    title="编辑"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(athlete.id)}
                                    className="text-red-600 hover:text-red-900"
                                    title="删除"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Entry Modal (Selection) */}
      {showQuickEntryModal && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">选择运动员录入成绩</h2>
                    <button onClick={() => { setShowQuickEntryModal(false); navigate('/athletes', { replace: true }); }} className="text-gray-500 hover:text-gray-700">
                        <span className="text-2xl">&times;</span>
                    </button>
                </div>
                
                <div className="mb-4">
                    <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="搜索姓名..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                    {filteredAthletes.map(athlete => (
                        <div 
                            key={athlete.id}
                            onClick={() => {
                                setShowQuickEntryModal(false);
                                navigate(`/athletes/${athlete.id}/log`);
                            }}
                            className="p-3 border rounded-md hover:bg-blue-50 cursor-pointer flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                     {athlete.avatar_url ? (
                                        <img src={athlete.avatar_url} alt={athlete.name} className="w-full h-full object-cover" />
                                     ) : (
                                        <User className="w-4 h-4 text-gray-500" />
                                     )}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-800">{athlete.name}</div>
                                    <div className="text-xs text-gray-500">
                                        {athlete.birth_year}年 · {athlete.gender} · {getBadgeLabel(athlete.venue, athlete.team)}
                                    </div>
                                </div>
                            </div>
                            <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                        </div>
                    ))}
                    {filteredAthletes.length === 0 && (
                        <div className="text-center text-gray-500 py-4">未找到匹配的运动员</div>
                    )}
                </div>
            </div>
         </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingAthlete ? "编辑运动员" : "添加新运动员"}</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">出生年份</label>
                  <input
                    type="number"
                    min="2000"
                    max="2030"
                    placeholder="如: 2015"
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {birthYear && (
                      <p className="text-xs text-blue-600 mt-1">
                          当前年龄: {CURRENT_YEAR - parseInt(birthYear)}岁
                      </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">性别</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="男">男</option>
                    <option value="女">女</option>
                  </select>
                </div>
              </div>
              
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
                    placeholder="请输入队伍名称 (如: 精英队)"
                    value={teamCustom}
                    onChange={(e) => setTeamCustom(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">训练状态</label>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">状态开始日期</label>
                  <input
                    type="date"
                    required
                    value={statusStartDate}
                    onChange={(e) => setStatusStartDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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
                  onClick={() => setShowModal(false)}
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

      {/* Quick Edit Venue/Team Modal */}
      {quickEditAthlete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-bold mb-4">修改场馆/队伍 - {quickEditAthlete.name}</h2>
            <form onSubmit={handleQuickEditSubmit}>
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
                  onClick={() => setQuickEditAthlete(null)}
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
      {/* Quick Edit Status Modal */}
      {quickEditStatusAthlete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-bold mb-4">修改训练状态 - {quickEditStatusAthlete.name}</h2>
            <form onSubmit={handleQuickStatusSubmit}>
              <div className="grid grid-cols-1 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">训练状态</label>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">状态开始日期</label>
                  <input
                    type="date"
                    required
                    value={statusStartDate}
                    onChange={(e) => setStatusStartDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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
                  onClick={() => setQuickEditStatusAthlete(null)}
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
