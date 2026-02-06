import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useCoachProfile } from '../hooks/useCoachProfile';
import { Plus, Search, Calendar as CalendarIcon, ChevronRight, ChevronDown, Image as ImageIcon, Loader2, X, ChevronUp, Maximize2, Copy, BookOpen, Save } from 'lucide-react';
import { TrainingPlan } from '../types';
import { cn } from '../lib/utils';
import { format, parseISO, startOfWeek, endOfWeek, getWeek, isSameDay, subDays, addDays, differenceInDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import TemplateLibraryView from '../components/templates/TemplateLibraryView';

export default function TrainingPlans() {
  const { profile } = useCoachProfile();
  // Check for task query param
  const [searchParams] = useState(new URLSearchParams(window.location.search));
  const taskId = searchParams.get('taskId');

  // If taskId exists, force 'record' tab
  const [activeTab, setActiveTab] = useState<'record' | 'query' | 'templates'>(taskId ? 'record' : 'record');
  const [selectedTemplate, setSelectedTemplate] = useState<{title: string, content: string, media_urls?: string[]} | null>(null);

  const handleUseTemplate = (template: {title: string, content: string, media_urls?: string[]}) => {
      setSelectedTemplate(template);
      setActiveTab('record');
  };

  return (
    <div className="space-y-6">
      {taskId && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
           <p className="font-bold text-blue-700">正在执行任务：上传训练计划</p>
           <p className="text-sm text-blue-600">提交后将自动标记任务完成</p>
        </div>
      )}
      <div className="flex space-x-4 border-b border-gray-200 overflow-x-auto">
        <button
          className={`py-2 px-4 border-b-2 font-medium text-sm whitespace-nowrap ${
            activeTab === 'record'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('record')}
        >
          记录当天计划
        </button>
        <button
          className={`py-2 px-4 border-b-2 font-medium text-sm whitespace-nowrap ${
            activeTab === 'query'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('query')}
        >
          查询往期计划
        </button>
        <button
          className={`py-2 px-4 border-b-2 font-medium text-sm whitespace-nowrap flex items-center ${
            activeTab === 'templates'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('templates')}
        >
          <BookOpen className="w-4 h-4 mr-1" />
          模板库
        </button>
      </div>

      {activeTab === 'record' && <RecordPlanView coachId={profile?.id} initialTemplate={selectedTemplate} onClearTemplate={() => setSelectedTemplate(null)} />}
      {activeTab === 'query' && <QueryPlanView coachId={profile?.id} />}
      {activeTab === 'templates' && <TemplateLibraryView onUseTemplate={handleUseTemplate} coachId={profile?.id} />}
    </div>
  );
}

// Removed old TemplateLibraryView function here

function RecordPlanView({ coachId, initialTemplate, onClearTemplate }: { coachId?: string, initialTemplate?: {title: string, content: string, media_urls?: string[]} | null, onClearTemplate?: () => void }) {
  const { getToken } = useAuth();
  const [searchParams] = useState(new URLSearchParams(window.location.search));
  const taskId = searchParams.get('taskId');

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [availableGroups, setAvailableGroups] = useState<string[]>(['2020组', '2019组', '2018组', '2017组']);
  const [newGroup, setNewGroup] = useState('');
  const [mediaUrls, setMediaUrls] = useState<{ type: 'image' | 'video'; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Template Saving State
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Apply template if provided
  useEffect(() => {
      if (initialTemplate) {
          setTitle(initialTemplate.title);
          setContent(initialTemplate.content);
          
          if (initialTemplate.media_urls && Array.isArray(initialTemplate.media_urls)) {
              const formattedMedia = initialTemplate.media_urls.map(url => {
                  const isVideo = url.match(/\.(mp4|mov|webm)$/i);
                  return {
                      type: isVideo ? 'video' : 'image',
                      url: url
                  };
              });
              setMediaUrls(formattedMedia as any);
          } else {
              setMediaUrls([]);
          }

          if (onClearTemplate) onClearTemplate();
      }
  }, [initialTemplate]);

  // Helper to get authenticated Supabase client
  const getSupabase = async () => {
    try {
      const token = await getToken({ template: 'supabase' });
      if (token) {
        return createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY,
          { global: { headers: { Authorization: `Bearer ${token}` } } }
        );
      }
    } catch (e) {
      console.warn('Failed to get Clerk token, falling back to anon client:', e);
    }
    return supabase;
  };

  // Fetch groups on load
  useEffect(() => {
    if (!coachId) return;
    async function fetchGroups() {
      const { data, error } = await supabase.from('training_groups').select('name').eq('coach_id', coachId);
      if (data && data.length > 0) {
        const dbGroups = data.map(g => g.name);
        setAvailableGroups(prev => Array.from(new Set([...prev, ...dbGroups])));
      }
    }
    fetchGroups();
  }, [coachId]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploading(true);

    try {
      const client = await getSupabase();
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${coachId || 'anon'}/${fileName}`;

      // 1. Upload
      const { error: uploadError } = await client.storage
        .from('training_plans')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload Error Details:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // 2. Get Public URL
      const { data } = client.storage
        .from('training_plans')
        .getPublicUrl(filePath);

      if (!data.publicUrl) {
        throw new Error('Failed to generate public URL');
      }

      console.log('File uploaded successfully:', data.publicUrl);
      
      const type = file.type.startsWith('video') ? 'video' : 'image';
      setMediaUrls(prev => [...prev, { type, url: data.publicUrl }]);
      
    } catch (error: any) {
      console.error('File Upload Process Failed:', error);
      alert('上传失败: ' + (error.message || '未知错误'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  const handleSaveAsTemplate = async () => {
      if(!coachId) {
          alert('无法获取教练信息，请刷新页面重试');
          return;
      }
      
      const targetTitle = title.trim();
      
      if(!targetTitle || !content) {
          alert('请先填写标题和内容');
          return;
      }

      
      if(selectedGroups.length === 0) {
          alert('请至少选择一个适用年龄组');
          return;
      }

      if(!confirm(`确定将当前计划保存为模板 "${targetTitle}" 吗？`)) return;

      try {
          const client = await getSupabase();
          
          // Use the first selected group as the primary age_group for strict isolation logic
          // (Even though target_groups is an array, we need a primary key for filtering)
          const primaryAgeGroup = selectedGroups[0];

          // Insert with default likes_count=0, favorites_count=0, type='user'
          const { error } = await client.from('training_plan_templates').insert({
              coach_id: coachId,
              title: targetTitle, 
              content: content, 
              target_groups: selectedGroups,
              age_group: primaryAgeGroup, // Strict isolation field
              type: 'user',
              likes_count: 0,
              favorites_count: 0
          });
          
          if(error) {
             console.error('Template insert error details:', error);
             throw error;
          }
          
          alert('模板保存成功！');
      } catch(e: any) {
          console.error('Full template save error:', e);
          alert('模板保存失败: ' + (e.message || '未知错误，请检查控制台'));
      }
  };

  async function handleSave() {
    if (!title || !content) {
      alert('请填写必要信息（标题、内容）');
      return;
    }
    
    setSaving(true);
    try {
      const client = await getSupabase();
      
      const payload = {
        coach_id: coachId, 
        date,
        title,
        content,
        target_groups: selectedGroups,
        media_urls: mediaUrls
      };

      console.log('Submitting payload:', payload);

      const { error, data } = await client.from('training_plans').insert(payload).select();
      
      if (error) {
        console.error('Supabase Save Error Full Object:', error);
        throw new Error(`Code: ${error.code}, Message: ${error.message}, Details: ${error.details || 'None'}`);
      }
      
      console.log('Save successful:', data);
      
      if (taskId && coachId) {
        try {
          const { error: taskError } = await client
            .from('task_submissions')
            .update({ 
              status: 'completed',
              submitted_at: new Date().toISOString(),
              submission_id: data[0].id
            })
            .eq('task_id', taskId)
            .eq('coach_id', coachId);

          if (taskError) {
             console.error('Failed to update task status:', taskError);
             alert('计划已保存，但任务状态更新失败，请联系管理员。');
          } else {
             alert('计划保存成功，任务已标记完成！');
             window.location.href = '/tasks';
             return;
          }
        } catch (taskEx) {
           console.error('Task update exception:', taskEx);
        }
      } else {
         // 需求变更：保存计划后直接存入“查询往期计划”，不强制刷新页面，但需重置表单
         alert('计划保存成功！请前往“查询往期计划”查看。');
      }
      
      // Reset form
      setTitle('');
      setContent('');
      setSelectedGroups([]);
      setMediaUrls([]);
      
    } catch (e: any) {
      console.error('Save Operation Failed:', e);
      alert(`保存失败:\n${e.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  const toggleGroup = (group: string) => {
    setSelectedGroups(prev => 
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const addNewGroup = async () => {
    if (!newGroup) return;
    if (newGroup.length < 2) {
      alert('组名过短');
      return;
    }
    if (availableGroups.includes(newGroup)) {
      alert('该组名已存在，请直接选择');
      setNewGroup('');
      return;
    }

    setAvailableGroups([...availableGroups, newGroup]);
    setSelectedGroups([...selectedGroups, newGroup]);
    
    if (coachId) {
      try {
          const client = await getSupabase();
          await client.from('training_groups').insert({
              coach_id: coachId,
              name: newGroup
          });
      } catch (e) {
          console.error('Failed to save group:', e);
      }
    }
    setNewGroup('');
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">日期</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">标题</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="例如：周三耐力训练"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">适用年龄组</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {availableGroups.map(group => (
            <button
              key={group}
              onClick={() => toggleGroup(group)}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-colors border-2 ${
                selectedGroups.includes(group)
                  ? 'bg-blue-100 text-blue-800 border-blue-500'
                  : 'bg-gray-100 text-gray-800 border-transparent hover:bg-gray-200'
              }`}
            >
              {group}
              {selectedGroups.includes(group) && (
                <X className="w-3 h-3 ml-1 hover:text-red-500" onClick={(e) => {
                  e.stopPropagation();
                  toggleGroup(group);
                }} />
              )}
            </button>
          ))}
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={newGroup}
                onChange={e => setNewGroup(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addNewGroup();
                  }
                }}
                placeholder="新增组名"
                className="w-40 text-xs border border-gray-300 rounded px-2 py-1 pr-8"
              />
              {newGroup && (
                <button 
                  onClick={addNewGroup} 
                  type="button" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200"
                  title="生成标签"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">训练内容</label>
        <textarea
          rows={6}
          value={content}
          onChange={e => setContent(e.target.value)}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          placeholder="在此输入训练内容..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">多媒体附件 (图片/视频)</label>
        <div className={`mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md ${uploading ? 'bg-gray-50 border-blue-300' : 'border-gray-300'}`}>
          <div className="space-y-1 text-center">
            {uploading ? (
              <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
            ) : (
              <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
            )}
            <div className="flex text-sm text-gray-600 justify-center">
              <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                <span>{uploading ? '正在上传...' : '上传文件'}</span>
                <input 
                  type="file" 
                  className="sr-only" 
                  accept="image/*,video/*" 
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
              {!uploading && <p className="pl-1">或拖拽到此处</p>}
            </div>
            <p className="text-xs text-gray-500">支持 PNG, JPG, MP4</p>
          </div>
        </div>
        {mediaUrls.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            {mediaUrls.map((media, idx) => (
              <div key={idx} className="relative aspect-video bg-black rounded overflow-hidden group">
                {media.type === 'video' ? (
                  <video src={media.url} className="w-full h-full object-cover" controls />
                ) : (
                  <img src={media.url} alt="附件" className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() => setMediaUrls(mediaUrls.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Removed "Save as Template" button as per new business rule */}
      {/* 
        <button
            onClick={handleSaveAsTemplate}
            className="text-gray-600 hover:text-blue-600 px-4 py-2 rounded-md border border-gray-200 hover:border-blue-300 flex items-center transition-colors text-sm font-medium"
        >
            <Save className="w-4 h-4 mr-2" />
            保存为模板
        </button>
      */}
      
      {/* Added Guidance Tip */}
      <div className="flex-1 flex items-center text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded border border-orange-100 mr-4">
         <BookOpen className="w-3 h-3 mr-1.5" />
         如需创建或管理模板，请前往“模板库”页面操作
      </div>

        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center shadow-sm"
        >
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {saving ? '保存中...' : '保存计划'}
        </button>
    </div>
  );
}

// -------------------------------------------------------------------------------------
// Query View: Month -> Week -> Day Hierarchy with Animations
// -------------------------------------------------------------------------------------

function QueryPlanView({ coachId }: { coachId?: string }) {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchDate, setSearchDate] = useState('');
  const [filteredPlans, setFilteredPlans] = useState<TrainingPlan[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]); // "YYYY-MM"
  const [expandedWeeks, setExpandedWeeks] = useState<string[]>([]); // "YYYY-MM-Wn"
  const [selectedPlan, setSelectedPlan] = useState<TrainingPlan | null>(null);

  useEffect(() => {
    if (coachId) fetchPlans();
  }, [coachId]);

  async function fetchPlans() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('training_plans')
        .select('*')
        .eq('coach_id', coachId)
        .order('date', { ascending: true }); 

      if (error) throw error;
      
      const allPlans = data || [];
      allPlans.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setPlans(allPlans);
      setFilteredPlans(allPlans);

      if (allPlans.length > 0) {
        const lastPlan = allPlans[allPlans.length - 1];
        const lastMonthKey = format(parseISO(lastPlan.date), 'yyyy-MM');
        setExpandedMonths([lastMonthKey]);
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!searchDate) {
      setFilteredPlans(plans);
      return;
    }

    const targetTime = new Date(searchDate).getTime();
    
    const exactMatches = plans.filter(p => p.date === searchDate);
    if (exactMatches.length > 0) {
      setFilteredPlans(exactMatches);
      return;
    }

    let closestPlan: TrainingPlan | null = null;
    let minDiff = Infinity;

    plans.forEach(p => {
      const diff = Math.abs(new Date(p.date).getTime() - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestPlan = p;
      }
    });

    if (closestPlan) {
      setFilteredPlans([closestPlan]);
    } else {
      setFilteredPlans([]);
    }
  }, [searchDate, plans]);

  const groupedPlans = useMemo(() => {
    const groups: Record<string, Record<string, TrainingPlan[]>> = {};

    filteredPlans.forEach(plan => {
      const date = parseISO(plan.date);
      const monthKey = format(date, 'yyyy-MM');
      const weekNum = getWeek(date, { locale: zhCN });
      const weekKey = `${monthKey}-W${weekNum}`;

      if (!groups[monthKey]) groups[monthKey] = {};
      if (!groups[monthKey][weekKey]) groups[monthKey][weekKey] = [];
      groups[monthKey][weekKey].push(plan);
    });

    return groups;
  }, [filteredPlans]);

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => 
      prev.includes(monthKey) ? prev.filter(m => m !== monthKey) : [...prev, monthKey]
    );
  };

  const toggleWeek = (weekKey: string) => {
    setExpandedWeeks(prev => 
      prev.includes(weekKey) ? prev.filter(w => w !== weekKey) : [...prev, weekKey]
    );
  };

  const sortedMonths = Object.keys(groupedPlans).sort().reverse(); 

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">按日期精确搜索</label>
          <div className="relative">
            <input
              type="date"
              value={searchDate}
              onChange={e => setSearchDate(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            {searchDate && (
               <button 
                 onClick={() => setSearchDate('')}
                 className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
               >
                 <X className="w-4 h-4" />
               </button>
            )}
          </div>
          {searchDate && filteredPlans.length > 0 && filteredPlans[0].date !== searchDate && (
            <p className="text-xs text-orange-500 mt-1">
              未找到当日计划，为您推荐最近的记录 ({filteredPlans[0].date})
            </p>
          )}
        </div>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
        >
          <Search className="w-4 h-4 mr-2" />
          搜索
        </button>
      </div>

      <div className="space-y-4">
        {sortedMonths.map(monthKey => {
           const [year, month] = monthKey.split('-');
           const isExpanded = expandedMonths.includes(monthKey);
           
           return (
             <div key={monthKey} className="bg-white rounded-lg shadow overflow-hidden border border-gray-100">
               <div 
                 onClick={() => toggleMonth(monthKey)}
                 className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
               >
                 <h3 className="font-bold text-lg text-gray-800">{year}年 {month}月</h3>
                 {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
               </div>

               <div className={cn(
                 "transition-all duration-300 ease-in-out overflow-hidden",
                 isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
               )}>
                 <div className="p-2 space-y-2">
                   {Object.keys(groupedPlans[monthKey]).sort().map(weekKey => {
                      const weekPlans = groupedPlans[monthKey][weekKey];
                      const firstDate = parseISO(weekPlans[0].date);
                      const start = startOfWeek(firstDate, { locale: zhCN });
                      const end = endOfWeek(firstDate, { locale: zhCN });
                      const isWeekExpanded = expandedWeeks.includes(weekKey);

                      return (
                        <div key={weekKey} className="border rounded-md">
                          <div 
                            onClick={() => toggleWeek(weekKey)}
                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-blue-50 transition-colors"
                          >
                            <span className="font-medium text-sm text-gray-600">
                              第 {weekKey.split('W')[1]} 周 ({format(start, 'MM.dd')} - {format(end, 'MM.dd')})
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                {weekPlans.length} 节课
                              </span>
                              {isWeekExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>

                          {isWeekExpanded && (
                            <div className="divide-y border-t bg-gray-50/50">
                              {weekPlans.map(plan => (
                                <div 
                                  key={plan.id} 
                                  onClick={() => setSelectedPlan(plan)}
                                  className="p-3 hover:bg-white hover:shadow-sm transition-all cursor-pointer flex justify-between items-center group"
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-gray-800">{format(parseISO(plan.date), 'dd日')}</span>
                                      <span className="font-medium text-blue-600">{plan.title}</span>
                                      
                                      <div className="ml-[10px] min-w-[150px] p-1.5 border border-blue-200 bg-blue-50 rounded text-xs text-blue-800 whitespace-pre-wrap leading-tight">
                                        {Array.isArray(plan.target_groups) && plan.target_groups.length > 0 
                                          ? plan.target_groups.join('、') 
                                          : '未录入年龄组次'
                                        }
                                      </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{plan.content}</p>
                                  </div>
                                  <div className="flex items-center text-gray-400 group-hover:text-blue-500">
                                     <span className="text-xs mr-2">详情</span>
                                     <ChevronRight className="w-4 h-4" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                   })}
                 </div>
               </div>
             </div>
           );
        })}
        
        {sortedMonths.length === 0 && !loading && (
          <div className="text-center py-10 text-gray-500 bg-white rounded-lg shadow">
            暂无相关计划数据
          </div>
        )}
      </div>

      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedPlan(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedPlan.title}</h2>
                  <p className="text-gray-500 mt-1">{selectedPlan.date} {format(parseISO(selectedPlan.date), 'EEEE', { locale: zhCN })}</p>
                </div>
                <button onClick={() => setSelectedPlan(null)} className="p-1 hover:bg-gray-100 rounded-full">
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {Array.isArray(selectedPlan.target_groups) && selectedPlan.target_groups.map((g: string) => (
                  <span key={g} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {g}
                  </span>
                ))}
              </div>

              <div className="prose max-w-none bg-gray-50 p-4 rounded-lg mb-6 whitespace-pre-wrap text-gray-700">
                {selectedPlan.content}
              </div>

              {Array.isArray(selectedPlan.media_urls) && selectedPlan.media_urls.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-900">附件</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedPlan.media_urls.map((media: any, idx: number) => (
                      <div key={idx} className="relative group aspect-square bg-black rounded-lg overflow-hidden cursor-zoom-in">
                        {media.type === 'video' ? (
                          <video src={media.url} className="w-full h-full object-cover" controls />
                        ) : (
                          <img 
                            src={media.url} 
                            alt="附件" 
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" 
                            onClick={() => window.open(media.url, '_blank')}
                          />
                        )}
                        {media.type !== 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 pointer-events-none">
                             <Maximize2 className="text-white w-6 h-6" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
