import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, User, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "../lib/supabase";
import { Athlete, AthleteStatusHistory } from "../types";
import { subDays, format } from "date-fns";

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
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null);
  
  // Quick Edit State
  const [quickEditAthlete, setQuickEditAthlete] = useState<Athlete | null>(null);

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

  // Grouping State
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const CURRENT_YEAR = new Date().getFullYear();

  useEffect(() => {
    if (user) {
      fetchAthletes();
    }
  }, [user]);

  async function fetchAthletes() {
    if (!user) return;
    setLoading(true);
    
    // Fetch athletes and their status history
    const { data, error } = await supabase
      .from("athletes")
      .select(`
        *,
        athlete_status_history (
          *
        )
      `)
      .eq("coach_id", user.id)
      .order("created_at", { ascending: false });

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
      if (processedData.length > 0) {
        // Generate initial group keys based on new grouping logic
        const groups = new Set<string>();
        processedData.forEach((a: Athlete) => {
            const by = a.birth_year;
            const g = a.gender || "未知";
            if (by) {
                groups.add(`${by}年${g}组`);
            } else {
                groups.add("未分组");
            }
        });
        setExpandedGroups(Array.from(groups));
      }
    }
    setLoading(false);
  }

  // Group athletes by Birth Year + Gender
  const groupedAthletes = useMemo(() => {
    const groups: Record<string, Athlete[]> = {};
    
    athletes.forEach(athlete => {
      let key = "未分组";
      if (athlete.birth_year) {
          const g = athlete.gender || "未知";
          key = `${athlete.birth_year}年${g}组`;
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(athlete);
    });
    
    // Sort keys: Younger (larger year) first? Or Older (smaller year) first?
    // Usually sports teams list older first or younger first.
    // Let's sort by Year Descending (Younger first) for now, or Year Ascending (Older first).
    // Let's do Year Descending (2020, 2019, 2018...)
    
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === "未分组") return 1;
      if (b === "未分组") return -1;
      
      // Extract year
      const yearA = parseInt(a);
      const yearB = parseInt(b);
      
      if (yearA !== yearB) return yearB - yearA; // Descending year
      
      // If year same, sort by gender (Women first? Men first?)
      // String comparison
      return a.localeCompare(b);
    });
    
    return sortedKeys.map(key => ({
      title: key,
      items: groups[key]
    }));
  }, [athletes]);

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
    
    // Determine venue state
    const currentVenue = athlete.venue || "";
    if (VENUE_OPTIONS.includes(currentVenue)) {
      setVenueSelect(currentVenue);
      setVenueCustom("");
    } else {
      setVenueSelect("其他");
      setVenueCustom(currentVenue);
    }

    // Determine team state
    const currentTeam = athlete.team || "";
    if (TEAM_OPTIONS.includes(currentTeam)) {
      setTeamSelect(currentTeam);
      setTeamCustom("");
    } else {
      setTeamSelect("其他");
      setTeamCustom(currentTeam);
    }
    
    // Status
    const cur = athlete.current_status;
    setStatus(cur?.status || 'training');
    setStatusStartDate(cur?.start_date || new Date().toISOString().split('T')[0]);
    setTransferDest(cur?.destination || "");
    
    setShowModal(true);
  }

  function openQuickEdit(athlete: Athlete) {
    setQuickEditAthlete(athlete);
    // Determine venue state
    const currentVenue = athlete.venue || "";
    if (VENUE_OPTIONS.includes(currentVenue)) {
      setVenueSelect(currentVenue);
      setVenueCustom("");
    } else {
      setVenueSelect("其他");
      setVenueCustom(currentVenue);
    }

    // Determine team state
    const currentTeam = athlete.team || "";
    if (TEAM_OPTIONS.includes(currentTeam)) {
      setTeamSelect(currentTeam);
      setTeamCustom("");
    } else {
      setTeamSelect("其他");
      setTeamCustom(currentTeam);
    }
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
          // Close old record
          if (currentStatus) {
              const newStart = new Date(statusStartDate);
              const endDate = subDays(newStart, 1);
              
              await supabase.from("athlete_status_history")
                  .update({ end_date: format(endDate, 'yyyy-MM-dd') })
                  .eq("id", currentStatus.id);
          }
          
          // Create new record
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
        // Create initial status history
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

  async function handleDelete(id: string) {
    if (!confirm("确定要删除这位运动员吗？")) return;

    const { error } = await supabase.from("athletes").delete().eq("id", id);
    if (error) {
      alert("删除运动员失败");
    } else {
      fetchAthletes();
    }
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">运动员管理</h1>
        <div className="flex gap-2">
           <button 
             onClick={() => toggleAll(true)}
             className="text-sm text-blue-600 hover:text-blue-800"
           >
             展开全部
           </button>
           <span className="text-gray-300">|</span>
           <button 
             onClick={() => toggleAll(false)}
             className="text-sm text-blue-600 hover:text-blue-800"
           >
             收起全部
           </button>
           <button
            onClick={openAddModal}
            className="ml-4 bg-dolphin-gold text-dolphin-blue font-bold px-4 py-2 rounded-md hover:bg-yellow-400 flex items-center shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            添加运动员
          </button>
        </div>
      </div>

      {athletes.length === 0 ? (
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
                  <div className="border-t border-gray-200 overflow-x-auto">
                     <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">出生年份 (年龄)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">性别</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {group.items.map((athlete) => {
                          const statusKey = athlete.current_status?.status || 'training';
                          const statusInfo = STATUS_CONFIG[statusKey];
                          const destination = athlete.current_status?.destination;

                          return (
                            <tr key={athlete.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <Link to={`/athletes/${athlete.id}`} className="text-blue-600 hover:underline font-medium flex items-center">
                                    <User className="w-4 h-4 mr-2 text-gray-400" />
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
                                  <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                                    [{statusInfo.label}]
                                    {destination && `·${destination}`}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                  {athlete.birth_year ? (
                                      <span>
                                          {athlete.birth_year}年
                                          <span className="text-xs text-gray-400 ml-1">(当前{getAge(athlete.birth_year)}岁)</span>
                                      </span>
                                  ) : "-"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-500">{athlete.gender || "-"}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => openEditModal(athlete)}
                                  className="text-blue-600 hover:text-blue-900 mr-3"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(athlete.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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
    </div>
  );
}
