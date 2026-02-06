import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useCoachProfile } from '../hooks/useCoachProfile';
import { useAuth } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase';
import { Competition, CompetitionResult } from '../types';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import { ArrowLeft, ChevronRight, Trophy, Plus, Trash2, Search, Upload, Save, Folder } from 'lucide-react';
// ... other imports

// Remove createClient import if we just use supabase from lib, OR import URL/Key from env if we really need a separate client (e.g. for different auth). 
// But the code uses `getToken` and creates a new client.
// So we need:
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function CompetitionRanking() {
  const { isAdmin, profile } = useCoachProfile();
  const { getToken } = useAuth();
  
  // Navigation State
  const [viewState, setViewState] = useState<'years' | 'list' | 'detail'>('years');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  
  // Data State
  const [years, setYears] = useState<number[]>([]);
  const [competitionsList, setCompetitionsList] = useState<Competition[]>([]);
  const [results, setResults] = useState<CompetitionResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter State (Detail View)
  const [searchQuery, setSearchQuery] = useState('');
  const [ageFilter, setAgeFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  
  // New Hierarchical Input State
  type InputGroup = {
      id: string;
      gender: string;
      ageGroup: string;
      event: string;
      rows: Partial<CompetitionResult>[];
      isExpanded: boolean;
  };
  const [inputGroups, setInputGroups] = useState<InputGroup[]>([]);
  
  // Constants
  const AGE_GROUPS = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', '15-17岁', '18岁以上'];
  const DEFAULT_EVENTS = [
      '50米自由泳', '100米自由泳', '200米自由泳', '400米自由泳', '800米自由泳', '1500米自由泳',
      '50米仰泳', '100米仰泳', '200米仰泳',
      '50米蛙泳', '100米蛙泳', '200米蛙泳',
      '50米蝶泳', '100米蝶泳', '200米蝶泳',
      '200米混合泳', '400米混合泳'
  ];
  const [customEvents, setCustomEvents] = useState<string[]>([]);
  const EVENT_TYPES = [...DEFAULT_EVENTS, ...customEvents];

  // Step State for Adding New Group
  const [addStep, setAddStep] = useState<1 | 2 | 3 | 4>(1);
  const [tempGender, setTempGender] = useState('');
  const [tempAge, setTempAge] = useState('');
  const [tempEvent, setTempEvent] = useState('');
  const [tempRows, setTempRows] = useState<Partial<CompetitionResult>[]>([]);
  
  // Custom Event Modal
  const [showCustomEventModal, setShowCustomEventModal] = useState(false);
  const [newCustomEvent, setNewCustomEvent] = useState('');

  const [pasteText, setPasteText] = useState('');
  const [isOCRProcessing, setIsOCRProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  // Helper to delete group
  const handleDeleteGroup = (groupId: string) => {
      setInputGroups(inputGroups.filter(g => g.id !== groupId));
  };

  // Helper to toggle group expansion
  const toggleGroupExpand = (groupId: string) => {
      setInputGroups(inputGroups.map(g => 
          g.id === groupId ? { ...g, isExpanded: !g.isExpanded } : g
      ));
  };


  // Initial Load (Years)
  useEffect(() => {
    fetchYears();
  }, []);

  async function fetchYears() {
    setLoading(true);
    const { data, error } = await supabase
      .from('competitions')
      .select('date')
      .order('date', { ascending: false });
    
    if (data) {
      const uniqueYears = Array.from(new Set(data.map(d => new Date(d.date).getFullYear())));
      setYears(uniqueYears);
      // Default to latest year if available
      if (uniqueYears.length > 0 && viewState === 'years') {
         handleSelectYear(uniqueYears[0]);
      }
    }
    setLoading(false);
  }

  async function handleSelectYear(year: number) {
    setSelectedYear(year);
    setViewState('list');
    setLoading(true);
    const { data } = await supabase
      .from('competitions')
      .select('*')
      .filter('date', 'gte', `${year}-01-01`)
      .filter('date', 'lte', `${year}-12-31`)
      .order('date', { ascending: false });
    
    setCompetitionsList(data || []);
    setLoading(false);
  }

  async function handleSelectComp(comp: Competition) {
    setSelectedComp(comp);
    setViewState('detail');
    setLoading(true);
    const { data } = await supabase
      .from('competition_results')
      .select('*')
      .eq('competition_id', comp.id);
    
    setResults(data || []);
    setLoading(false);
  }

  const parseRawData = (rows: any[][], targetRows?: Partial<CompetitionResult>[]) => {
    if (rows.length === 0) return;

    const parsed: Partial<CompetitionResult>[] = targetRows ? [...targetRows] : [];
    
    // Simple parser for pasted data: Name, Score, Rank (optional)
    // If 3 columns: Name, Score, Rank
    // If 2 columns: Name, Score (Rank auto?)
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const cleanRow = row.map(c => c !== undefined && c !== null ? String(c).trim() : '').filter(c => c !== '');
        if (cleanRow.length === 0) continue;

        // Skip potential headers
        if (cleanRow.some(c => c.includes('姓名') || c.includes('Name'))) continue;

        const entry: Partial<CompetitionResult> = {
            athlete_name: cleanRow[0],
            score: cleanRow[1] || '',
            rank: cleanRow[2] ? parseInt(cleanRow[2]) : 0
        };
        
        if (entry.athlete_name) {
            parsed.push(entry);
        }
    }
    return parsed;
  };

  const handlePaste = () => {
    const rows = pasteText.split('\n').map(line => line.split(/\t|,/));
    const parsed = parseRawData(rows, tempRows);
    if (parsed) setTempRows(parsed);
    setPasteText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setIsOCRProcessing(true);
      setOcrProgress(0);
      
      Tesseract.recognize(
        file,
        'chi_sim',
        { 
          logger: m => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.floor(m.progress * 100));
            }
          }
        }
      ).then(({ data: { text } }) => {
        setIsOCRProcessing(false);
        setPasteText(text);
        // Auto-trigger paste parsing? Or let user click.
        // Let's just set paste text and let user verify/click.
      }).catch(err => {
        console.error(err);
        setIsOCRProcessing(false);
        alert('识别失败，请重试');
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      const parsed = parseRawData(data, tempRows);
      if (parsed) setTempRows(parsed);
    };
    reader.readAsBinaryString(file);
  };

  const GENDER_MAP: Record<string, string> = {
      '1': '男子',
      '2': '女子',
      '3': '混合'
  };

  // Helpers
  const formatDisplayScore = (val: string) => {
      // Normalize input to MM:SS.hh
      let v = val.trim();
      if (!v) return '00:00.00';
      
      // If already matches format, return
      if (/^\d{2}:\d{2}\.\d{2}$/.test(v)) return v;

      // Pure digits handling
      const digits = v.replace(/\D/g, '');
      if (!digits) return '00:00.00';

      let min = 0, sec = 0, centi = 0;

      if (v.includes(':') || v.includes('.')) {
          // Try to parse basic parts if separators exist
          // e.g. "1:05.2" -> 1, 05, 20
          // This is complex, stick to digit logic if ambiguous, or simple parse
          // Let's rely on the digit parsing which is more robust for rapid entry
          // If user typed separators, we might strip them and use digit logic unless it's standard
      }
      
      // Digit Logic per prompt: "5" -> 00:05.00
      const d = parseInt(digits);
      if (digits.length <= 2) {
          sec = d;
      } else if (digits.length <= 4) {
          sec = parseInt(digits.slice(0, -2));
          centi = parseInt(digits.slice(-2));
      } else {
          centi = parseInt(digits.slice(-2));
          sec = parseInt(digits.slice(-4, -2));
          min = parseInt(digits.slice(0, -4));
      }

      // Constraints
      if (centi > 99) centi = 99;
      if (sec > 59) sec = 59;
      // Min no limit? Prompt says 0-59 but 1500m might take longer? 
      // Prompt says "Range limit: Minutes 0-59". 
      // If > 59 min, it should probably be hour? But standard swimming format usually MM:SS.hh or H:MM:SS.hh
      // Prompt says "Display template: MM:SS.hh". So max 59:59.99?
      // "Boundary test: 59:59.99"
      if (min > 59) min = 59;

      return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${centi.toString().padStart(2, '0')}`;
  };

  const scoreToMs = (score: string) => {
      const parts = score.split(':');
      if (parts.length !== 2) return 0;
      const min = parseInt(parts[0]);
      const secParts = parts[1].split('.');
      const sec = parseInt(secParts[0]);
      const centi = parseInt(secParts[1] || '0');
      return (min * 60 * 1000) + (sec * 1000) + (centi * 10);
  };

  const msToScore = (val: string) => {
      if (!val) return '-';
      // If it looks like MM:SS.hh, return it (legacy)
      if (val.includes(':')) return val;
      
      const ms = parseInt(val);
      if (isNaN(ms)) return val;
      
      const totalCenti = Math.round(ms / 10);
      const centi = totalCenti % 100;
      const totalSec = Math.floor(totalCenti / 100);
      const sec = totalSec % 60;
      const min = Math.floor(totalSec / 60);
      
      return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${centi.toString().padStart(2, '0')}`;
  };

  const handleAddCustomEvent = () => {
      const name = newCustomEvent.trim();
      if (!name) return;
      if (EVENT_TYPES.includes(name)) {
          alert('该项目已存在');
          return;
      }
      setCustomEvents([...customEvents, name]);
      setNewCustomEvent('');
      setShowCustomEventModal(false);
  };

  const handleAddGroup = () => {
      if (tempRows.length === 0) {
          alert('请至少添加一条成绩记录');
          return;
      }
      const newGroup: InputGroup = {
          id: crypto.randomUUID(),
          gender: tempGender,
          ageGroup: tempAge,
          event: tempEvent,
          rows: tempRows,
          isExpanded: true
      };
      setInputGroups([newGroup, ...inputGroups]);
      // Reset
      setTempRows([]);
      setAddStep(1);
      setTempGender('');
      setTempAge('');
      setTempEvent('');
  };

  const handleSaveCompetition = async () => {
    if (!profile || !newTitle || inputGroups.length === 0) return;

    try {
        // Get Supabase Token
        let token = null;
        try {
            // Attempt to get the specialized Supabase token
            token = await getToken({ template: 'supabase' });
        } catch (err) {
            console.warn('Supabase JWT template not found. Falling back to anonymous client.', err);
            // Do NOT fallback to getToken() as it returns a Clerk session token which Supabase cannot verify (causes "No suitable key" error)
        }
        
        // Use authenticated client if token exists, otherwise use global anon client
        const client = token 
            ? createClient(supabaseUrl, supabaseKey, {
                global: { headers: { Authorization: `Bearer ${token}` } },
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
              })
            : supabase; // Global client uses ANON key

        console.log('Publishing with profile:', profile, 'Client mode:', token ? 'Authenticated' : 'Anonymous');

        // 1. Create Competition

        console.log('Publishing with profile:', profile);

        // 1. Create Competition
        const { data: compData, error: compError } = await client
            .from('competitions')
            .insert({
                title: newTitle,
                date: newDate,
                created_by: profile.id
            })
            .select()
            .single();
        
        if (compError) throw compError;

        // 2. Flatten and Insert Results
        const resultsToInsert: any[] = [];
        inputGroups.forEach(group => {
            const genderLabel = GENDER_MAP[group.gender];
            const fullAgeGroup = `${genderLabel} ${group.ageGroup}`; // Persist gender in age_group
            
            group.rows.forEach(row => {
                // Convert score to ms string
                const scoreMs = scoreToMs(row.score || '00:00.00').toString();
                
                resultsToInsert.push({
                    competition_id: compData.id,
                    athlete_name: row.athlete_name,
                    age_group: fullAgeGroup, 
                    event: group.event,
                    score: scoreMs,
                    rank: row.rank || 0
                });
            });
        });

        const { error: resError } = await client
            .from('competition_results')
            .insert(resultsToInsert);
        
        if (resError) throw resError;

        alert('发布成功！');
        setShowAddModal(false);
        setNewTitle('');
        setInputGroups([]);
        fetchYears(); 
    } catch (e: any) {
        console.error(e);
        alert('发布失败: ' + e.message);
    }
  };

  async function handleDeleteComp(id: string) {
      if (!confirm('确定删除此比赛记录吗？')) return;
      await supabase.from('competitions').delete().eq('id', id);
      if (selectedYear) handleSelectYear(selectedYear);
  }

  // Filter Logic
  const filteredResults = useMemo(() => {
      return results.filter(r => {
          const matchSearch = r.athlete_name.includes(searchQuery) || r.event.includes(searchQuery);
          const matchAge = ageFilter === 'all' || r.age_group === ageFilter;
          const matchEvent = eventFilter === 'all' || r.event === eventFilter;
          return matchSearch && matchAge && matchEvent;
      });
  }, [results, searchQuery, ageFilter, eventFilter]);

  const uniqueAges = Array.from(new Set(results.map(r => r.age_group))).sort();
  const uniqueEvents = Array.from(new Set(results.map(r => r.event))).sort();

  // Render Helpers
  const renderYears = () => (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {years.map(year => (
              <button 
                key={year}
                onClick={() => handleSelectYear(year)}
                className={`p-6 rounded-xl border-2 text-xl font-bold transition-all ${
                    selectedYear === year 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                }`}
              >
                  {year}年
              </button>
          ))}
          {years.length === 0 && !loading && <div className="col-span-4 text-center text-gray-500">暂无数据</div>}
      </div>
  );

  const renderList = () => (
      <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
              <button onClick={() => { setViewState('years'); setSelectedYear(null); }} className="text-gray-500 hover:text-gray-900">
                  <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold">{selectedYear}年 积分赛列表</h2>
          </div>
          {competitionsList.map(comp => (
              <div key={comp.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition-shadow">
                  <div className="flex-1 cursor-pointer" onClick={() => handleSelectComp(comp)}>
                      <h3 className="font-bold text-lg text-gray-800">{comp.title}</h3>
                      <p className="text-sm text-gray-500">{format(new Date(comp.date), 'yyyy年MM月dd日')}</p>
                  </div>
                  <div className="flex items-center gap-4">
                      <button onClick={() => handleSelectComp(comp)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full">
                          <ChevronRight className="w-5 h-5" />
                      </button>
                      {isAdmin && (
                          <button onClick={() => handleDeleteComp(comp.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full">
                              <Trash2 className="w-4 h-4" />
                          </button>
                      )}
                  </div>
              </div>
          ))}
          {competitionsList.length === 0 && <div className="text-center text-gray-500 py-8">该年份暂无比赛记录</div>}
      </div>
  );

  // Detail View: Grouping Logic for U6 Mixed Display
  const groupedResults = useMemo(() => {
      // 1. Filter first
      const filtered = results.filter(r => {
          const matchSearch = r.athlete_name.includes(searchQuery) || r.event.includes(searchQuery);
          // If filtering by age, U6 logic might be tricky if user specifically selects "男子 U6" or "女子 U6".
          // But our filter is usually by string match. 
          // Our age_group format is "Gender Age". e.g. "男子 U6", "女子 U6".
          // The ageFilter dropdown has "U6", "U7" etc. 
          // So if ageFilter is "U6", we match any string containing "U6".
          const matchAge = ageFilter === 'all' || r.age_group.includes(ageFilter);
          const matchEvent = eventFilter === 'all' || r.event === eventFilter;
          return matchSearch && matchAge && matchEvent;
      });

      // 2. Grouping
      // Structure: { [AgeGroup]: { [Event]: { [Gender]: Result[] } } }
      // Special case: U6 Male and U6 Female -> Merge into "U6 混合组"
      
      const groups: Record<string, Record<string, Record<string, CompetitionResult[]>>> = {};
      
      filtered.forEach(r => {
          let displayAgeGroup = r.age_group;
          let displayGender = '未知';

          // Parse gender/age from "男子 U6" string
          const parts = r.age_group.split(' ');
          if (parts.length >= 2) {
              const gender = parts[0];
              const age = parts.slice(1).join(' '); // "U6"
              displayGender = gender;
              
              if (age === 'U6') {
                  displayAgeGroup = 'U6 混合组';
              } else {
                  displayAgeGroup = age; // Just "U7", "U8" etc, or keep full? 
                  // User request: "Merge U6 into U6 Mixed". Others usually kept separate or per design.
                  // Let's group by Age Group Key first.
                  // If we want "U7" to also show gender split, we can use same logic.
                  // Let's assume we group by Age Label (e.g. U6, U7, U8) and then split by Event -> Gender.
                  displayAgeGroup = age;
              }
          } else {
             // Fallback if format is different
             displayAgeGroup = r.age_group;
          }

          if (!groups[displayAgeGroup]) groups[displayAgeGroup] = {};
          if (!groups[displayAgeGroup][r.event]) groups[displayAgeGroup][r.event] = {};
          if (!groups[displayAgeGroup][r.event][displayGender]) groups[displayAgeGroup][r.event][displayGender] = [];
          
          groups[displayAgeGroup][r.event][displayGender].push(r);
      });
      
      return groups;
  }, [results, searchQuery, ageFilter, eventFilter]);

  // Collapsible State for Detail View
  const [expandedAges, setExpandedAges] = useState<Record<string, boolean>>({});
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  const toggleAge = (age: string) => setExpandedAges(prev => ({...prev, [age]: !prev[age]}));
  const toggleEvent = (key: string) => setExpandedEvents(prev => ({...prev, [key]: !prev[key]}));

  const renderDetail = () => (
      <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
              <button onClick={() => { setViewState('list'); setSelectedComp(null); }} className="text-gray-500 hover:text-gray-900">
                  <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                  <h2 className="text-xl font-bold">{selectedComp?.title}</h2>
                  <p className="text-xs text-gray-500">{selectedComp?.date}</p>
              </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow-sm flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">搜索</label>
                  <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="姓名 / 项目..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                  </div>
              </div>
              <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">年龄组</label>
                  <select 
                    value={ageFilter} 
                    onChange={e => setAgeFilter(e.target.value)}
                    className="w-32 py-2 px-3 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                      <option value="all">全部</option>
                      {AGE_GROUPS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
              </div>
              <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">项目</label>
                  <select 
                    value={eventFilter} 
                    onChange={e => setEventFilter(e.target.value)}
                    className="w-32 py-2 px-3 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                      <option value="all">全部</option>
                      {uniqueEvents.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
              </div>
          </div>

          {/* Grouped Results Display */}
          <div className="space-y-4">
              {Object.keys(groupedResults).sort().map(ageGroup => {
                  const isAgeExpanded = expandedAges[ageGroup] ?? (ageGroup === 'U6 混合组' ? false : true); // Default U6 collapsed per request, others expanded? Or all expanded? Request says "Default collapsed" for U6 Mixed.
                  // Let's default expand others for usability, collapse U6 Mixed.
                  // Actually request specifically mentions U6 Mixed default collapsed.
                  
                  return (
                      <div key={ageGroup} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                          {/* Level 1: Age Group Header */}
                          <div 
                              className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => toggleAge(ageGroup)}
                          >
                              <div className="flex items-center gap-2">
                                  <Folder className={`w-5 h-5 text-blue-600 transition-transform ${isAgeExpanded ? 'rotate-90' : ''}`} />
                                  <span className="font-bold text-lg text-gray-800">{ageGroup}</span>
                              </div>
                              <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                                  {Object.values(groupedResults[ageGroup]).reduce((acc, ev) => acc + Object.values(ev).reduce((a, g) => a + g.length, 0), 0)} 条记录
                              </span>
                          </div>

                          {/* Level 1 Content */}
                          {isAgeExpanded && (
                              <div className="p-4 space-y-3">
                                  {Object.keys(groupedResults[ageGroup]).sort().map(event => {
                                      const eventKey = `${ageGroup}-${event}`;
                                      const isEventExpanded = expandedEvents[eventKey] ?? false;

                                      return (
                                          <div key={event} className="border border-gray-100 rounded-md">
                                              {/* Level 2: Event Header */}
                                              <div 
                                                  className="p-3 flex items-center gap-2 cursor-pointer hover:bg-blue-50 transition-colors"
                                                  onClick={() => toggleEvent(eventKey)}
                                              >
                                                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isEventExpanded ? 'rotate-90' : ''}`} />
                                                  <span className="font-medium text-gray-700">{event}</span>
                                              </div>

                                              {/* Level 3: Gender & Data */}
                                              {isEventExpanded && (
                                                  <div className="pl-9 pr-4 pb-4 space-y-4">
                                                      {Object.keys(groupedResults[ageGroup][event]).sort().map(gender => (
                                                          <div key={gender}>
                                                              <h4 className="text-xs font-bold text-gray-500 mb-2 border-l-2 border-blue-400 pl-2">{gender}</h4>
                                                              <div className="space-y-1">
                                                                  {groupedResults[ageGroup][event][gender]
                                                                    .sort((a, b) => a.rank - b.rank)
                                                                    .map(r => (
                                                                      <div key={r.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                                                          <div className="flex items-center gap-2">
                                                                              <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold ${
                                                                                  r.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                                                                  r.rank === 2 ? 'bg-gray-100 text-gray-700' :
                                                                                  r.rank === 3 ? 'bg-orange-100 text-orange-700' :
                                                                                  'text-gray-400'
                                                                              }`}>
                                                                                  {r.rank}
                                                                              </span>
                                                                              <span className="text-gray-900">{r.athlete_name}</span>
                                                                          </div>
                                                                          <span className="font-mono font-bold text-blue-600">{msToScore(r.score)}</span>
                                                                      </div>
                                                                  ))}
                                                              </div>
                                                          </div>
                                                      ))}
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
              {Object.keys(groupedResults).length === 0 && (
                  <div className="text-center text-gray-500 py-12">无匹配数据</div>
              )}
          </div>
      </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Trophy className="w-6 h-6 mr-2 text-yellow-500" />
          积分赛数据公示
        </h1>
        {isAdmin && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            发布新成绩
          </button>
        )}
      </div>

      {viewState === 'years' && renderYears()}
      {viewState === 'list' && renderList()}
      {viewState === 'detail' && renderDetail()}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">发布新积分赛成绩</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">比赛标题</label>
                    <input 
                      type="text" 
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder="例如: 2025年第一季度积分赛"
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">比赛日期</label>
                    <input 
                      type="date" 
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                </div>
            </div>

            {/* Wizard Steps */}
            {addStep === 1 && (
                <div className="mb-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center">
                        <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">1</span>
                        选择性别
                    </h3>
                    <div className="flex gap-4 justify-center py-4">
                        {[
                            { val: '1', label: '男' },
                            { val: '2', label: '女' },
                            { val: '3', label: '混合' }
                        ].map(opt => (
                            <label 
                                key={opt.val} 
                                className={`flex items-center justify-center w-24 h-12 border rounded-lg cursor-pointer transition-all ${
                                    tempGender === opt.val 
                                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold ring-2 ring-blue-200' 
                                    : 'border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <input 
                                    type="radio" 
                                    name="gender" 
                                    value={opt.val}
                                    checked={tempGender === opt.val}
                                    onChange={e => setTempGender(e.target.value)}
                                    className="hidden"
                                />
                                {opt.label}
                            </label>
                        ))}
                    </div>
                    <div className="flex justify-end mt-4">
                        <button 
                            onClick={() => setAddStep(2)}
                            disabled={!tempGender}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            下一步
                        </button>
                    </div>
                </div>
            )}

            {addStep === 2 && (
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <button onClick={() => setAddStep(1)} className="text-gray-500 hover:text-gray-900">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h3 className="text-lg font-bold flex items-center">
                            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">2</span>
                            选择年龄组
                        </h3>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                        {AGE_GROUPS.map(age => (
                            <button
                                key={age}
                                onClick={() => { setTempAge(age); setAddStep(3); }}
                                className={`p-3 rounded-lg border text-center hover:border-blue-500 hover:bg-blue-50 transition-all ${tempAge === age ? 'border-blue-600 bg-blue-100 ring-2 ring-blue-300' : 'border-gray-200'}`}
                            >
                                {age}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {addStep === 3 && (
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <button onClick={() => setAddStep(2)} className="text-gray-500 hover:text-gray-900">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h3 className="text-lg font-bold flex items-center">
                            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">3</span>
                            选择比赛项目 ({GENDER_MAP[tempGender]} - {tempAge})
                        </h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {EVENT_TYPES.map(evt => (
                            <button
                                key={evt}
                                onClick={() => { setTempEvent(evt); setAddStep(4); }}
                                className={`p-3 rounded-lg border text-center hover:border-blue-500 hover:bg-blue-50 transition-all ${tempEvent === evt ? 'border-blue-600 bg-blue-100 ring-2 ring-blue-300' : 'border-gray-200'}`}
                            >
                                {evt}
                            </button>
                        ))}
                        <button
                            onClick={() => setShowCustomEventModal(true)}
                            className="p-3 rounded-lg border border-dashed border-[#999] text-center text-gray-600 hover:bg-[#f5f5f5] transition-all flex items-center justify-center gap-2 text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            自定义项目
                        </button>
                    </div>
                </div>
            )}

            {addStep === 4 && (
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4 justify-between">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setAddStep(3)} className="text-gray-500 hover:text-gray-900">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <h3 className="text-lg font-bold flex items-center">
                                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">4</span>
                                录入成绩 ({GENDER_MAP[tempGender]} - {tempAge} - {tempEvent})
                            </h3>
                        </div>
                    </div>

                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-gray-700">导入数据</label>
                            <div className="text-xs text-gray-500">
                                格式：姓名 | 成绩 (MM:SS.hh) | 排名
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                             {/* Paste Area */}
                            <div className="border rounded-md p-2">
                                <textarea 
                                    rows={5}
                                    placeholder="在此处粘贴表格数据..."
                                    value={pasteText}
                                    onChange={e => setPasteText(e.target.value)}
                                    className="w-full border-none focus:ring-0 text-sm font-mono resize-none"
                                />
                                <div className="flex justify-end border-t pt-2 mt-2">
                                    <button 
                                        onClick={handlePaste}
                                        disabled={!pasteText}
                                        className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 disabled:opacity-50"
                                    >
                                        解析数据
                                    </button>
                                </div>
                            </div>

                             {/* OCR / File Upload */}
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors">
                                <input 
                                  type="file" 
                                  accept=".xlsx, .xls, image/*"
                                  onChange={handleFileUpload}
                                  className="hidden"
                                  id="file-upload"
                                />
                                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center w-full h-full justify-center">
                                    {isOCRProcessing ? (
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                            <span className="text-xs text-blue-600">识别中 {ocrProgress}%</span>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                            <span className="text-sm text-gray-600">上传Excel或图片</span>
                                        </>
                                    )}
                                </label>
                            </div>
                        </div>

                        {/* Temp Table Preview */}
                        <div className="border border-gray-200 rounded-md overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">姓名</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">成绩 (MM:SS.hh)</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">排名</th>
                                        <th className="px-3 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {tempRows.map((r, i) => (
                                        <tr key={i} className="group">
                                            <td className="px-3 py-1">
                                                <input 
                                                    value={r.athlete_name} 
                                                    onChange={(e) => {
                                                        const newRows = [...tempRows];
                                                        newRows[i].athlete_name = e.target.value;
                                                        setTempRows(newRows);
                                                    }}
                                                    className="w-full border-none focus:ring-0 p-0 text-sm"
                                                    placeholder="姓名"
                                                />
                                            </td>
                                            <td className="px-3 py-1 text-right">
                                                <input 
                                                    value={r.score} 
                                                    onChange={(e) => {
                                                        const newRows = [...tempRows];
                                                        newRows[i].score = e.target.value;
                                                        setTempRows(newRows);
                                                    }}
                                                    onBlur={(e) => {
                                                        const newRows = [...tempRows];
                                                        newRows[i].score = formatDisplayScore(e.target.value);
                                                        setTempRows(newRows);
                                                    }}
                                                    className={`w-full border-none focus:ring-0 p-0 text-sm text-right font-mono ${
                                                        !/^\d{2}:\d{2}\.\d{2}$/.test(r.score || '') && r.score ? 'text-red-500' : ''
                                                    }`}
                                                    placeholder="00:00.00"
                                                />
                                            </td>
                                            <td className="px-3 py-1 text-right">
                                                <input 
                                                    value={r.rank || ''} 
                                                    onChange={(e) => {
                                                        const newRows = [...tempRows];
                                                        newRows[i].rank = parseInt(e.target.value) || 0;
                                                        setTempRows(newRows);
                                                    }}
                                                    className="w-full border-none focus:ring-0 p-0 text-sm text-right"
                                                    placeholder="排名"
                                                />
                                            </td>
                                            <td className="px-3 py-1 text-center">
                                                <button 
                                                    onClick={() => setTempRows(tempRows.filter((_, idx) => idx !== i))}
                                                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td colSpan={4} className="px-3 py-2 text-center border-t border-dashed">
                                            <button 
                                                onClick={() => setTempRows([...tempRows, { athlete_name: '', score: '', rank: 0 }])}
                                                className="text-sm text-blue-600 hover:text-blue-800 flex items-center justify-center w-full"
                                            >
                                                <Plus className="w-4 h-4 mr-1" /> 添加一行
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="flex justify-end mt-4">
                            <button 
                                onClick={handleAddGroup}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                保存此组记录
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Added Groups List (Collapsible Cards) */}
            {inputGroups.length > 0 && (
                <div className="mb-6 space-y-4">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">已添加的记录组 ({inputGroups.length})</h3>
                    {inputGroups.map(group => (
                        <div key={group.id} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white">
                            <div 
                                className="flex justify-between items-center p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                                onClick={() => toggleGroupExpand(group.id)}
                            >
                                <div className="flex items-center gap-2">
                                    <ChevronRight className={`w-5 h-5 transition-transform ${group.isExpanded ? 'rotate-90' : ''}`} />
                                    <span className="font-bold text-gray-800">{group.ageGroup} - {group.event}</span>
                                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">{group.rows.length} 条记录</span>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                                    className="text-gray-400 hover:text-red-500 p-1"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            
                            {group.isExpanded && (
                                <div className="p-0">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">姓名</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">成绩</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">排名</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {group.rows.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2 text-sm text-gray-900">{row.athlete_name}</td>
                                                    <td className="px-4 py-2 text-sm text-right font-mono">{row.score}</td>
                                                    <td className="px-4 py-2 text-sm text-right">{row.rank}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">

                <button 
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                    取消
                </button>
                <button 
                    onClick={handleSaveCompetition}
                    disabled={inputGroups.length === 0 || !newTitle}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                    <Save className="w-4 h-4 mr-2" />
                    确认发布
                </button>

            </div>
          </div>
        </div>
      )}
      {/* Custom Event Modal */}
      {showCustomEventModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
              <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                  <h3 className="text-lg font-bold mb-4">添加自定义项目</h3>
                  <input 
                      type="text" 
                      value={newCustomEvent}
                      onChange={e => setNewCustomEvent(e.target.value)}
                      placeholder="输入项目名称"
                      maxLength={50}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      autoFocus
                  />
                  <div className="flex justify-end gap-3">
                      <button 
                          onClick={() => setShowCustomEventModal(false)}
                          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                      >
                          取消
                      </button>
                      <button 
                          onClick={handleAddCustomEvent}
                          disabled={!newCustomEvent.trim()}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                          确认添加
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
