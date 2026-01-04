import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useUser } from "@clerk/clerk-react";
import { Trophy, Search, User, Calendar, MapPin, Check, ChevronDown } from "lucide-react";
import { format, subMonths, subYears } from "date-fns";

interface RankingEntry {
  id: string;
  time_seconds: number;
  stroke: string;
  training_logs: {
    date: string;
    athletes: {
      id: string;
      name: string;
      birth_year: number | null;
      gender: string;
      coach_id: string;
      venue: string | null;
      team: string | null;
      coaches?: {
        first_name: string | null;
        last_name: string | null;
      };
    };
  };
}

export default function Ranking() {
  const { user } = useUser();
  const [selectedGroup, setSelectedGroup] = useState<string>(""); // Format: "birthYear|gender"
  const [selectedStroke, setSelectedStroke] = useState<string>("");
  const [timeRange, setTimeRange] = useState<string>("1m");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  
  // Venue Filter
  const [availableVenues, setAvailableVenues] = useState<string[]>([]);
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]); // Empty means "All"
  const [isVenueDropdownOpen, setIsVenueDropdownOpen] = useState(false);
  const venueDropdownRef = useRef<HTMLDivElement>(null);

  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filter Options
  const [availableGroups, setAvailableGroups] = useState<{label: string, value: string}[]>([]);
  const [availableStrokes, setAvailableStrokes] = useState<string[]>([]);

  const CURRENT_YEAR = new Date().getFullYear();

  useEffect(() => {
    fetchFilters();
    
    // Click outside to close venue dropdown
    function handleClickOutside(event: MouseEvent) {
      if (venueDropdownRef.current && !venueDropdownRef.current.contains(event.target as Node)) {
        setIsVenueDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedGroup && selectedStroke) {
      fetchRankings();
    }
  }, [selectedGroup, selectedStroke, timeRange, customStartDate, customEndDate, selectedVenues]);

  async function fetchFilters() {
    // Fetch unique birth_year/gender/venue
    const { data: athletes } = await supabase
      .from("athletes")
      .select("birth_year, gender, venue");
    
    if (athletes) {
      const uniqueGroups = new Set<string>();
      const uniqueVenues = new Set<string>();
      
      athletes.forEach(a => {
        if (a.birth_year) {
            const gender = a.gender || '混合';
            uniqueGroups.add(`${a.birth_year}|${gender}`);
        }
        if (a.venue) {
            uniqueVenues.add(a.venue);
        }
      });
      
      const groups = Array.from(uniqueGroups).map(g => {
          const [by, gender] = g.split('|');
          return {
              label: `${by}年${gender}组`,
              value: g,
              birthYear: parseInt(by),
              gender: gender
          };
      }).sort((a, b) => {
          if (a.birthYear !== b.birthYear) return b.birthYear - a.birthYear; // Younger (larger year) first? Or Older first? Let's do Descending Year (Younger first)
          return a.gender.localeCompare(b.gender);
      });

      setAvailableGroups(groups);
      if (groups.length > 0) setSelectedGroup(groups[0].value);
      
      setAvailableVenues(Array.from(uniqueVenues).sort());
    }

    // Fetch unique strokes
    const { data: strokes } = await supabase
      .from("performance_entries")
      .select("stroke");
      
    if (strokes) {
      const uniqueStrokes = Array.from(new Set(strokes.map(s => s.stroke))).sort();
      setAvailableStrokes(uniqueStrokes);
      if (uniqueStrokes.length > 0) setSelectedStroke(uniqueStrokes[0]);
    }
  }

  const toggleVenue = (venue: string) => {
    if (venue === "all") {
        setSelectedVenues([]);
    } else {
        setSelectedVenues(prev => {
            if (prev.includes(venue)) {
                return prev.filter(v => v !== venue);
            } else {
                return [...prev, venue];
            }
        });
    }
  };

  async function fetchRankings() {
    if (!selectedGroup) return;
    const [birthYear, gender] = selectedGroup.split('|');

    // Calculate date range
    let startDate: string | null = null;
    let endDate: string | null = null;
    const now = new Date();

    if (timeRange === 'custom') {
        if (!customStartDate || !customEndDate) return; // Wait for both dates
        startDate = customStartDate;
        endDate = customEndDate;
    } else {
        endDate = format(now, 'yyyy-MM-dd');
        let startObj = now;
        switch (timeRange) {
            case '1m': startObj = subMonths(now, 1); break;
            case '3m': startObj = subMonths(now, 3); break;
            case '6m': startObj = subMonths(now, 6); break;
            case '1y': startObj = subYears(now, 1); break;
        }
        startDate = format(startObj, 'yyyy-MM-dd');
    }

    setLoading(true);
    
    // Query
    let query = supabase
      .from("performance_entries")
      .select(`
        id,
        time_seconds,
        stroke,
        training_logs!inner (
          date,
          athletes!inner (
            id,
            name,
            birth_year,
            gender,
            coach_id,
            venue,
            team,
            coaches (
                first_name,
                last_name
            )
          )
        )
      `)
      .eq("stroke", selectedStroke)
      .eq("training_logs.athletes.birth_year", parseInt(birthYear))
      .eq("training_logs.athletes.gender", gender)
      .gte("training_logs.date", startDate)
      .lte("training_logs.date", endDate)
      .order("time_seconds", { ascending: true })
      .limit(50);

    // Apply Venue Filter
    if (selectedVenues.length > 0) {
        query = query.in("training_logs.athletes.venue", selectedVenues);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching rankings:", error);
    } else {
      setRankings(data as any || []);
    }
    setLoading(false);
  }

  // Helper to get venue badge color
  const getVenueColor = (venue: string | null) => {
    if (!venue) return "bg-gray-100 text-gray-800";
    // Simple hash to color mapping
    const colors = [
        "bg-blue-100 text-blue-800",
        "bg-green-100 text-green-800",
        "bg-yellow-100 text-yellow-800",
        "bg-purple-100 text-purple-800",
        "bg-pink-100 text-pink-800",
        "bg-indigo-100 text-indigo-800",
        "bg-red-100 text-red-800",
        "bg-orange-100 text-orange-800",
    ];
    let hash = 0;
    for (let i = 0; i < venue.length; i++) {
        hash = venue.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Trophy className="w-8 h-8 text-yellow-500 mr-2" />
          成绩排行榜
        </h1>
        
        <div className="bg-white p-4 rounded-lg shadow flex flex-wrap gap-2 md:gap-4 items-end">
          {/* Venue Filter (Multi-select) */}
          <div className="relative w-full sm:w-auto" ref={venueDropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">场馆对比</label>
            <button
                onClick={() => setIsVenueDropdownOpen(!isVenueDropdownOpen)}
                className="border border-gray-300 rounded-md px-3 py-2 bg-white flex items-center justify-between w-full sm:min-w-[160px] text-sm focus:ring-2 focus:ring-blue-500"
            >
                <span className="truncate max-w-[120px]">
                    {selectedVenues.length === 0 ? "全部场馆" : selectedVenues.join(", ")}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500 ml-2" />
            </button>
            
            {isVenueDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-10 p-2">
                    <div 
                        className="flex items-center px-2 py-2 hover:bg-gray-50 rounded cursor-pointer"
                        onClick={() => toggleVenue("all")}
                    >
                        <div className={`w-4 h-4 border rounded mr-2 flex items-center justify-center ${selectedVenues.length === 0 ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                            {selectedVenues.length === 0 && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-sm">全部场馆</span>
                    </div>
                    <div className="h-px bg-gray-100 my-1"></div>
                    {availableVenues.map(venue => (
                        <div 
                            key={venue} 
                            className="flex items-center px-2 py-2 hover:bg-gray-50 rounded cursor-pointer"
                            onClick={() => toggleVenue(venue)}
                        >
                            <div className={`w-4 h-4 border rounded mr-2 flex items-center justify-center ${selectedVenues.includes(venue) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                {selectedVenues.includes(venue) && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-sm">{venue}</span>
                        </div>
                    ))}
                    {availableVenues.length === 0 && <div className="text-xs text-gray-400 px-2">无场馆数据</div>}
                </div>
            )}
          </div>

          {/* Group Filter */}
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">组别</label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none min-w-[140px]"
              >
                {availableGroups.map(group => (
                  <option key={group.value} value={group.value}>{group.label}</option>
                ))}
                {availableGroups.length === 0 && <option value="">暂无数据</option>}
              </select>
          </div>

          {/* Stroke Filter */}
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">泳姿</label>
              <select
                value={selectedStroke}
                onChange={(e) => setSelectedStroke(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none min-w-[160px]"
              >
                {availableStrokes.map(stroke => (
                  <option key={stroke} value={stroke}>{stroke}</option>
                ))}
                {availableStrokes.length === 0 && <option value="">暂无数据</option>}
              </select>
          </div>

          {/* Time Range Filter */}
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">时间段</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none min-w-[120px]"
              >
                <option value="1m">近1个月</option>
                <option value="3m">近3个月</option>
                <option value="6m">近6个月</option>
                <option value="1y">近1年</option>
                <option value="custom">自定义</option>
              </select>
          </div>

          {/* Custom Date Inputs */}
          {timeRange === 'custom' && (
              <div className="flex gap-2 items-center">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">开始日期</label>
                    <input 
                        type="date" 
                        value={customStartDate}
                        onChange={e => setCustomStartDate(e.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-2 text-sm"
                    />
                  </div>
                  <span className="text-gray-400 pb-2">-</span>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">结束日期</label>
                    <input 
                        type="date" 
                        value={customEndDate}
                        onChange={e => setCustomEndDate(e.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-2 text-sm"
                    />
                  </div>
              </div>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">加载中...</div>
        ) : rankings.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            暂无符合条件的记录
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-16">排名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">场馆</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">运动员</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">教练</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">成绩 (秒)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rankings.map((entry, index) => {
                const isMine = entry.training_logs.athletes.coach_id === user?.id;
                const venue = entry.training_logs.athletes.venue;
                const age = entry.training_logs.athletes.birth_year 
                    ? CURRENT_YEAR - entry.training_logs.athletes.birth_year 
                    : null;

                return (
                  <tr key={entry.id} className={isMine ? "bg-green-50" : "hover:bg-gray-50"}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`
                        flex items-center justify-center w-8 h-8 rounded-full font-bold
                        ${index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                          index === 1 ? 'bg-gray-100 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-500'}
                      `}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        {venue ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getVenueColor(venue)}`}>
                                <div className={`w-2 h-2 rounded-full mr-1.5 ${getVenueColor(venue).replace('bg-', 'bg-opacity-50 bg-').replace('text-', 'bg-')}`}></div>
                                {venue}
                            </span>
                        ) : (
                            <span className="text-gray-400 text-xs">-</span>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-4 h-4 mr-2 text-gray-400" />
                        <div>
                            <span className="font-bold text-gray-900">
                            {entry.training_logs.athletes.name}
                            </span>
                            {age && <span className="text-xs text-gray-400 ml-1">({age}岁)</span>}
                        </div>
                        {isMine && <span className="ml-2 text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">我的运动员</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {isMine ? "我" : (() => {
                          const c = entry.training_logs.athletes.coaches;
                          if (c && (c.first_name || c.last_name)) {
                              return `${c.last_name || ''}${c.first_name || ''}`;
                          }
                          return `${entry.training_logs.athletes.coach_id.slice(0, 8)}...`;
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                      {entry.time_seconds}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">
                      {format(new Date(entry.training_logs.date), 'yyyy年MM月dd日')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
