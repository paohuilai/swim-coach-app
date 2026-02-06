import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { ArrowLeft, Plus, Trash2, Save, Info, AlertCircle, Search, ChevronDown, ChevronUp, Clock, User, Timer, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { format, subDays } from "date-fns";
import { STROKES, TEST_TYPES, RPE_SCALE } from "../constants/swimming";
import { useUser } from "@clerk/clerk-react";
import { useCoachProfile } from "../hooks/useCoachProfile";
import { useAuditLog } from "../hooks/useAuditLog";
import { useSupabaseAuth } from "../hooks/useSupabaseAuth";
import { formatSwimTime, parseSwimTime, SWIMMING_TERMINOLOGY } from "../lib/terminology";

import MediaUploader from "../components/MediaUploader";

// --- Types ---
type PerformanceField = {
  stroke: string;
  time_seconds: number;
  // UI Display Value (for smart input)
  display_time: string;
  timing_method: 'electronic' | 'manual';
  split_times: string[]; // Array of strings like "00:12.50"
  reaction_time: string; // string for input "0.65"
  is_expanded?: boolean;
};

type FormValues = {
  // Basic Info
  test_type: string;
  pool_info: string;
  recorder: string;
  date: string;
  
  // Records
  performances: PerformanceField[];
  
  // Tech & Status
  stroke_rate: string; // input as string
  stroke_length: string;
  rpe: string; // 1-10
  status_score: number;
  status_note: string;
};

// --- Helpers ---
// Use imported formatSwimTime and parseSwimTime from lib/terminology

// --- Components ---

const StrokeSelect = ({ index, value, onChange }: { index: number, value: string, onChange: (val: string) => void }) => {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
        >
            <option value="">请选择泳姿</option>
            {STROKES.map((group: any) => (
                <optgroup key={group.group} label={group.group}>
                    {group.items.map((item: string) => (
                        <option key={item} value={item}>{item}</option>
                    ))}
                </optgroup>
            ))}
        </select>
    );
};

const Toast = ({ message, type, onClose, action }: { message: string, type: 'success' | 'error', onClose: () => void, action?: { label: string, onClick: () => void } }) => {
    useEffect(() => {
        if (!action) {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [onClose, action]);

    return (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 text-white animate-fade-in ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {type === 'success' ? <Save className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{message}</span>
            {action && (
                <button 
                    onClick={action.onClick}
                    className="ml-4 px-2 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 rounded text-xs font-bold transition-colors"
                >
                    {action.label}
                </button>
            )}
            {action && (
                 <button onClick={onClose} className="ml-2 hover:opacity-80"><X className="w-4 h-4" /></button>
            )}
        </div>
    );
};

// --- Main Page ---

export default function TrainingEntry() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { profile } = useCoachProfile();
  const { logAction } = useAuditLog();
  const { getClient } = useSupabaseAuth();
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error', action?: { label: string, onClick: () => void } } | null>(null);
  const [coaches, setCoaches] = useState<{ id: string, first_name: string, last_name: string }[]>([]);
  
  // Check for task query param
  const searchParams = new URLSearchParams(location.search);
  const taskId = searchParams.get('taskId');
  
  // Auto-save key
  const DRAFT_KEY = `training_draft_${id}`;

  const { register, control, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      test_type: "日常体能测试",
      pool_info: "",
      recorder: "", // Will default to current user if not set
      date: format(new Date(), "yyyy-MM-dd"),
      performances: [{ stroke: "", time_seconds: 0, display_time: "", timing_method: 'electronic', split_times: [], reaction_time: "", is_expanded: true }],
      stroke_rate: "",
      stroke_length: "",
      rpe: "3",
      status_score: 80,
      status_note: ""
    }
  });

  const [savedTemplates, setSavedTemplates] = useState<{name: string, data: any}[]>(() => {
    const saved = localStorage.getItem('training_templates');
    return saved ? JSON.parse(saved) : [];
  });

  // Set default recorder once profile/coaches loaded
  useEffect(() => {
      // Default pool info to 25米池 if not set
      if (!watch('pool_info')) {
          setValue('pool_info', '25米池');
      }

      // Default recorder to current user name
      if (profile && !watch('recorder')) {
          const name = `${profile.last_name || ''}${profile.first_name || ''}`.trim();
          // We set it as the string value. The select will match if it exists in list, or be custom.
          if (name) setValue('recorder', name);
      }
  }, [profile, setValue, watch]);

  // Fetch Coaches
  useEffect(() => {
      async function fetchCoaches() {
          if (!profile?.venue) return;
          const { data } = await supabase
              .from('coaches')
              .select('id, first_name, last_name')
              .eq('venue', profile.venue);
          
          if (data) setCoaches(data);
      }
      fetchCoaches();
  }, [profile?.venue]);

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "performances"
  });

  // Calculate segments helper
  const getSplitConfig = (stroke: string) => {
      const match = stroke.match(/(\d+)米/);
      if (!match) return { count: 0, label: '' };
      
      const dist = parseInt(match[1]);
      // Logic: 50m -> 2x25m. 100m -> 2x50m. 200m -> 4x50m. 400m -> 8x50m?
      // User req: "e.g. 50m auto-split into front 25m/back 25m"
      
      if (dist === 50) return { count: 2, label: '25米分段' };
      if (dist === 100) return { count: 2, label: '50米分段' }; // Front/Back 50
      if (dist === 200) return { count: 4, label: '50米分段' };
      if (dist === 400) return { count: 4, label: '100米分段' }; 
      if (dist === 800) return { count: 8, label: '100米分段' };
      if (dist === 1500) return { count: 15, label: '100米分段' };
      
      return { count: 0, label: '' };
  };

  const handleScoreBlur = (index: number, val: string) => {
      const formatted = formatSwimTime(val);
      setValue(`performances.${index}.display_time`, formatted);
  };

  const handleSplitBlur = (index: number, splitIndex: number, val: string) => {
      // 1. Format current split
      const formatted = formatSwimTime(val);
      setValue(`performances.${index}.split_times.${splitIndex}`, formatted);
      
      // 2. Auto-sum
      const currentSplits = watch(`performances.${index}.split_times`);
      if (currentSplits && currentSplits.every(s => s)) {
          const totalSec = currentSplits.reduce((acc, curr) => acc + parseSwimTime(curr), 0);
          if (totalSec > 0) {
              // Convert seconds back to mm:ss.cc
              const m = Math.floor(totalSec / 60);
              const s = Math.floor(totalSec % 60);
              const c = Math.round((totalSec - m * 60 - s) * 100);
              const totalStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${c.toString().padStart(2, '0')}`;
              setValue(`performances.${index}.display_time`, totalStr);
          }
      }
  };

  // Load draft
  useEffect(() => {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
          try {
              const parsed = JSON.parse(draft);
              // Ensure date is valid or reset to today
              if (!parsed.date) parsed.date = format(new Date(), "yyyy-MM-dd");
              reset(parsed);
              setToast({ 
                  msg: "已加载上次未保存的草稿", 
                  type: 'success',
                  action: {
                      label: "清空草稿",
                      onClick: () => {
                          localStorage.removeItem(DRAFT_KEY);
                          // Reset to defaults
                          reset({
                              test_type: "日常体能测试",
                              pool_info: "",
                              recorder: "", 
                              date: format(new Date(), "yyyy-MM-dd"),
                              performances: [{ stroke: "", time_seconds: 0, display_time: "", timing_method: 'electronic', split_times: [], reaction_time: "", is_expanded: true }],
                              stroke_rate: "",
                              stroke_length: "",
                              rpe: "3",
                              status_score: 80,
                              status_note: ""
                          });
                          setToast(null);
                      }
                  }
              });
          } catch (e) {
              console.error("Draft load error", e);
          }
      }
  }, [reset, DRAFT_KEY]);

  // Auto save
  const [autoSaved, setAutoSaved] = useState(false);
  
  useEffect(() => {
      const timer = setInterval(() => {
          const currentValues = watch();
          // Only save if dirty? No, save draft always just in case.
          localStorage.setItem(DRAFT_KEY, JSON.stringify(currentValues));
          setAutoSaved(true);
          setTimeout(() => setAutoSaved(false), 2000);
      }, 30000); // 30 seconds

      // Also save on unmount
      return () => {
          clearInterval(timer);
          const currentValues = watch();
          localStorage.setItem(DRAFT_KEY, JSON.stringify(currentValues));
      };
  }, [watch, DRAFT_KEY]);

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateGroups, setTemplateGroups] = useState<string[]>([]);
  const [templateContent, setTemplateContent] = useState("");
  const [templateMedia, setTemplateMedia] = useState<string[]>([]);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const openSaveTemplateModal = () => {
      if (!user?.id) {
          setToast({ msg: "请先登录", type: 'error' });
          return;
      }
      const current = watch();
      // Generate content string from performances
      const contentStr = current.performances
          .filter(p => p.stroke)
          .map(p => {
              let line = `${p.stroke}`;
              if (p.display_time) line += ` - ${p.display_time}`;
              if (p.split_times && p.split_times.length > 0) {
                  line += `\n  分段: ${p.split_times.join(' | ')}`;
              }
              return line;
          })
          .join('\n\n');
      
      if (!contentStr) {
          setToast({ msg: "请先录入至少一项有效成绩", type: 'error' });
          return;
      }

      setTemplateContent(contentStr);
      setTemplateTitle(`训练记录 ${format(new Date(), "MM-dd")}`);
      setTemplateGroups([]); // Force selection
      setTemplateMedia([]); // Reset media
      setShowTemplateModal(true);
  };

  const handleConfirmSaveTemplate = async () => {
      if (!templateTitle.trim()) {
          alert("请输入模板标题");
          return;
      }
      if (templateGroups.length === 0) {
          alert("请选择适用年龄段");
          return;
      }
      
      setIsSavingTemplate(true);
      try {
          const client = await getClient();
          const { error } = await client
              .from('training_plan_templates')
              .insert({
                  coach_id: user?.id,
                  title: templateTitle.trim(),
                  content: templateContent,
                  age_group: templateGroups.join(','),
                  target_groups: templateGroups,
                  media_urls: templateMedia, // Save media
                  type: 'user'
              });
          
          if (error) throw error;
          
          setToast({ msg: "模板保存成功！", type: 'success' });
          setShowTemplateModal(false);
      } catch (e: any) {
          console.error("Save template error:", e);
          setToast({ msg: "保存失败: " + e.message, type: 'error' });
      } finally {
          setIsSavingTemplate(false);
      }
  };

  const toggleGroup = (group: string) => {
      setTemplateGroups(prev => 
          prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
      );
  };

  const onSubmit = async (data: FormValues) => {
    if (!id) return;
    setSubmitting(true);

    try {
      // 1. Create Log
      const { data: logData, error: logError } = await supabase
        .from("training_logs")
        .insert([
          {
            athlete_id: id,
            date: data.date,
            distance_km: 0, 
            status_score: data.status_score,
            status_note: data.status_note,
            test_type: data.test_type,
            pool_info: data.pool_info,
            recorder: data.recorder,
            rpe: parseInt(data.rpe) || null,
            stroke_rate: parseInt(data.stroke_rate) || null,
            stroke_length: parseFloat(data.stroke_length) || null,
          },
        ])
        .select()
        .single();

      if (logError) throw logError;

      logAction('create_log', 'training_log', logData.id, { 
          date: data.date, test_type: data.test_type 
      });

      // 2. Create Entries
      if (data.performances.length > 0) {
        const validEntries = data.performances.filter(p => p.stroke && p.display_time);
        if (validEntries.length > 0) {
            const entries = validEntries.map((p) => ({
              log_id: logData.id,
              stroke: p.stroke,
              time_seconds: parseSwimTime(p.display_time),
              timing_method: p.timing_method,
              split_times: p.split_times, 
              reaction_time: parseFloat(p.reaction_time) || null
            }));

            const { error: perfError } = await supabase
              .from("performance_entries")
              .insert(entries);

            if (perfError) throw perfError;
        }
      }

      // 3. Mark Task Completed if taskId exists
      if (taskId && profile?.id) {
          try {
            await supabase
              .from('task_submissions')
              .update({ 
                status: 'completed',
                submitted_at: new Date().toISOString(),
                submission_id: logData.id
              })
              .eq('task_id', taskId)
              .eq('coach_id', profile.id);
          } catch (taskEx) {
             console.error('Task update exception:', taskEx);
          }
      }

      // Clear draft
      localStorage.removeItem(DRAFT_KEY);
      setToast({ msg: "保存成功！", type: 'success' });
      
      setTimeout(() => {
          if (taskId) {
            navigate('/tasks'); 
          } else {
            navigate(`/athletes/${id}`);
          }
      }, 1000);

    } catch (error: any) {
      console.error(error);
      setToast({ msg: "保存失败: " + error.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800">保存为训练模板</h3>
                    <button onClick={() => setShowTemplateModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">模板标题 <span className="text-red-500">*</span></label>
                        <input 
                            value={templateTitle}
                            onChange={e => setTemplateTitle(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="例如：50米自测验组合"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">适用年龄段 (多选) <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-3 gap-2">
                            {['2020组', '2019组', '2018组', '2017组', '2016组', '2015组'].map(g => (
                                <button
                                    key={g}
                                    type="button"
                                    onClick={() => toggleGroup(g)}
                                    className={`px-2 py-2 text-xs font-medium rounded border transition-all ${
                                        templateGroups.includes(g) 
                                        ? 'bg-blue-600 text-white border-blue-600' 
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                                    }`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                        {templateGroups.length === 0 && <p className="text-xs text-red-500 mt-1">必须至少选择一个年龄段</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">训练内容预览</label>
                        <textarea 
                            value={templateContent}
                            onChange={e => setTemplateContent(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 h-32 text-sm font-mono bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">多媒体附件 (图片/视频)</label>
                        <MediaUploader 
                            files={templateMedia} 
                            onFilesChange={setTemplateMedia} 
                        />
                    </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button 
                        onClick={() => setShowTemplateModal(false)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-md text-sm font-medium"
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleConfirmSaveTemplate}
                        disabled={isSavingTemplate || !templateTitle || templateGroups.length === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center"
                    >
                        {isSavingTemplate ? '保存中...' : '确认保存'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} action={toast.action} onClose={() => setToast(null)} />}

      
      {/* Auto Save Indicator */}
      <div 
        className={`fixed top-0 left-0 w-full bg-green-500 text-white text-xs text-center py-1 z-[60] transition-opacity duration-500 pointer-events-none ${autoSaved ? 'opacity-100' : 'opacity-0'}`}
      >
          草稿已自动保存
      </div>
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
          <Link to={`/athletes/${id}`} className="text-gray-500 hover:text-gray-900 flex items-center transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="font-medium">返回详情</span>
          </Link>
          <div className="text-right">
              <h1 className="text-xl font-bold text-gray-900">录入训练记录</h1>
              <p className="text-sm text-blue-600 font-medium">日常测试专用</p>
          </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* 1. Basic Info Card */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-gray-100 px-6 py-3 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-800">基础信息</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">测试类型 <span className="text-red-500">*</span></label>
                    <select 
                        {...register("test_type", { required: true })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        {TEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">日期 <span className="text-red-500">*</span></label>
                    <input
                        type="date"
                        max={format(new Date(), "yyyy-MM-dd")}
                        min={format(subDays(new Date(), 7), "yyyy-MM-dd")}
                        {...register("date", { required: true })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">泳池信息</label>
                    <div className="relative">
                        <Info className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                        <input
                            {...register("pool_info")}
                            placeholder="长度+类型+水温，如：50m标准池/26℃"
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400 text-sm"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">记录人</label>
                    <div className="relative">
                        <User className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                        <select
                            {...register("recorder", { required: true })}
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                        >
                            <option value="">请选择记录员</option>
                            {coaches.map(c => (
                                <option key={c.id} value={`${c.last_name}${c.first_name}`}>
                                    {c.last_name}{c.first_name}
                                </option>
                            ))}
                            {/* Fallback if list empty or user not in list */}
                            {!coaches.find(c => `${c.last_name}${c.first_name}` === watch('recorder')) && watch('recorder') && (
                                <option value={watch('recorder')}>{watch('recorder')}</option>
                            )}
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            </div>
        </div>

        {/* 2. Test Records Card (Core) */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-md">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white">
                <h2 className="text-lg font-bold text-gray-800">测试成绩记录</h2>
                <div className="text-sm text-gray-500">
                    已添加 {fields.length}/10 条
                </div>
            </div>
            
            <div className="p-6 space-y-4 bg-gray-50/50 min-h-[300px]">
                {fields.map((field, index) => (
                    <div key={field.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm relative group hover:border-blue-300 transition-colors">
                        {/* Remove Button */}
                        <button
                            type="button"
                            onClick={() => { if(confirm('确定删除此条记录吗？')) remove(index); }}
                            className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                            {/* Stroke Selection */}
                            <div className="md:col-span-4">
                                <label className="block text-xs font-bold text-gray-500 mb-1">泳姿 <span className="text-red-500">*</span></label>
                                <Controller
                                    control={control}
                                    name={`performances.${index}.stroke`}
                                    rules={{ required: true }}
                                    render={({ field: { value, onChange } }) => (
                                        <StrokeSelect index={index} value={value} onChange={onChange} />
                                    )}
                                />
                                {errors.performances?.[index]?.stroke && <span className="text-xs text-red-500">必填</span>}
                            </div>

                            {/* Time Input */}
                            <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-gray-500 mb-1">成绩 <span className="text-red-500">*</span></label>
                                <Controller
                                    control={control}
                                    name={`performances.${index}.display_time`}
                                    rules={{ 
                                        required: true, 
                                        validate: v => {
                                            const sec = parseSwimTime(v);
                                            return sec > 0 && sec < 3600; // reasonable limit
                                        }
                                    }}
                                    render={({ field: { value, onChange, onBlur } }) => (
                                        <div className="relative">
                                            <Clock className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                                            <input
                                                value={value}
                                                onChange={onChange}
                                                onBlur={(e) => {
                                                    handleScoreBlur(index, e.target.value);
                                                    onBlur();
                                                }}
                                                placeholder="2635 -> 00:26.35"
                                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md font-mono text-lg font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    )}
                                />
                                {errors.performances?.[index]?.display_time && <span className="text-xs text-red-500">格式错误或超出范围</span>}
                            </div>

                            {/* Timing Method */}
                            <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-gray-500 mb-1">计时方式</label>
                                <select
                                    {...register(`performances.${index}.timing_method`)}
                                    className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm"
                                >
                                    <option value="electronic">电子计时</option>
                                    <option value="manual">人工计时</option>
                                </select>
                            </div>
                            
                            {/* Expand Toggle */}
                            <div className="md:col-span-2 flex justify-end pt-6">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        const current = fields[index];
                                        update(index, { ...current, is_expanded: !current.is_expanded });
                                    }}
                                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                                >
                                    {field.is_expanded ? '收起详情' : '更多数据'}
                                    {field.is_expanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                                </button>
                            </div>
                        </div>

                        {/* Extended Data */}
                        {field.is_expanded && (
                            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/30 p-3 rounded">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">
                                        出发反应时 (秒) 
                                        <span className="text-gray-400 font-normal ml-1">输入23自动转为0.23</span>
                                    </label>
                                    <input 
                                        type="text"
                                        placeholder="0.65"
                                        {...register(`performances.${index}.reaction_time`, { 
                                            validate: v => {
                                                if(!v) return true;
                                                const num = parseFloat(v);
                                                return !isNaN(num) && num >= 0 && num <= 9.99;
                                            }
                                        })}
                                        onChange={(e) => {
                                            let val = e.target.value;
                                            // Auto-format logic: 
                                            // If integer > 9 (e.g. 23, 65), convert to 0.xx
                                            // If < 10 but integer, wait? No, user might type 0.5
                                            // Let's format on blur instead to be less intrusive, 
                                            // OR handle simple integers
                                            
                                            // Regex to check if it's a "clean" integer > 9
                                            if (/^[1-9]\d+$/.test(val)) {
                                                // Don't auto-convert immediately while typing? 
                                                // Requirement says "Enter 23 system automatically converts to 0.23"
                                                // Usually better on blur, or if length is sufficient?
                                                // Let's do it on Blur to allow typing "1.2" without it becoming "0.12" immediately
                                            }
                                            setValue(`performances.${index}.reaction_time`, val);
                                        }}
                                        onBlur={(e) => {
                                            let val = e.target.value;
                                            if (!val) return;
                                            
                                            // Logic:
                                            // 1. If it looks like an integer (e.g. "65"), make it "0.65"
                                            // 2. If it's "5", make it "0.50"? Or keep "5"? Requirement says "0-9 range".
                                            // Let's assume if no decimal point and > 0.
                                            
                                            if (!val.includes('.')) {
                                                const num = parseInt(val);
                                                if (!isNaN(num)) {
                                                    if (num >= 10 && num <= 99) {
                                                        val = `0.${num}`;
                                                    } else if (num > 0 && num < 10) {
                                                        // "5" -> "0.5" or "0.05"? Usually reaction time "5" means "0.05" is too fast, "0.5" is normal.
                                                        // But "23" -> "0.23".
                                                        // Let's stick to: Integers are treated as centiseconds if > 10?
                                                        // Or just strict rule: 23 -> 0.23.
                                                        // If user types "5", maybe they mean 5 seconds? No, range limit 9.99.
                                                        // Let's only convert double digits.
                                                    }
                                                }
                                            }
                                            
                                            // Validate range
                                            const num = parseFloat(val);
                                            if (!isNaN(num)) {
                                                if (num > 9.99) {
                                                    alert("数值必须在 0-9.99 之间");
                                                    val = "";
                                                }
                                            }
                                            
                                            setValue(`performances.${index}.reaction_time`, val);
                                        }}
                                        className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                
                                {/* Split Times */}
                                {(() => {
                                    const splitConfig = getSplitConfig(field.stroke);
                                    if (splitConfig.count > 0) {
                                        return (
                                            <div className="md:col-span-2 border-t border-blue-100 pt-2 mt-2">
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="block text-xs font-bold text-gray-500">
                                                        分段成绩 ({splitConfig.label})
                                                    </label>
                                                    <span className="text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                                                        录入分段自动计算总成绩
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                    {Array.from({ length: splitConfig.count }).map((_, i) => (
                                                        <div key={i} className="relative">
                                                            <div className="absolute left-2 top-1.5 text-[10px] text-gray-400">
                                                                {i + 1}
                                                            </div>
                                                            <input
                                                                {...register(`performances.${index}.split_times.${i}`)}
                                                                placeholder="00:00.00"
                                                                className="w-full border border-gray-300 rounded-md pl-6 pr-2 py-1 text-sm font-mono focus:border-blue-500 outline-none"
                                                                onBlur={(e) => handleSplitBlur(index, i, e.target.value)}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">分段成绩</label>
                                            <div className="text-xs text-gray-400 py-1.5 italic">当前项目无需分段</div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                ))}

                {fields.length < 10 && (
                    <button
                        type="button"
                        onClick={() => append({ stroke: "", time_seconds: 0, display_time: "", timing_method: 'electronic', split_times: [], reaction_time: "", is_expanded: true })}
                        className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center font-bold"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        添加下一条记录
                    </button>
                )}
            </div>
        </div>

        {/* 3. Tech & Status Card */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-gray-100 px-6 py-3 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-800">技术与状态评估</h2>
            </div>
            <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">划频 (次/分) <span className="text-gray-400 font-normal text-xs">(选填)</span></label>
                        <input 
                            type="number"
                            {...register("stroke_rate", { min: 20, max: 80, required: false })}
                            placeholder="20-80"
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">划幅 (米/次) <span className="text-gray-400 font-normal text-xs">(选填)</span></label>
                        <input 
                            type="number"
                            step="0.1"
                            {...register("stroke_length", { required: false })}
                            placeholder="保留1位小数"
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                    </div>
                    <div className="relative group">
                        <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center">
                            RPE 自感疲劳度 <span className="text-gray-400 font-normal text-xs ml-1">(选填)</span>
                            <Info className="w-3 h-3 ml-1 text-gray-400" />
                        </label>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-0 mb-2 w-64 bg-black text-white text-xs rounded p-2 hidden group-hover:block z-10">
                            Borg量表: 1(非常轻松) - 10(极限)
                        </div>
                        <select 
                            {...register("rpe", { required: false })}
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                        >
                            <option value="">请选择</option>
                            {RPE_SCALE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                    <label className="block text-sm font-bold text-gray-700 mb-4">当天状态评分: {watch("status_score")} <span className="text-gray-400 font-normal text-xs">(选填)</span></label>
                    <input 
                        type="range"
                        min="0"
                        max="100"
                        {...register("status_score", { required: false })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0 (极差)</span>
                        <span>50 (一般)</span>
                        <span>100 (极佳)</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">教练备注 (支持Markdown) <span className="text-gray-400 font-normal text-xs">(选填)</span></label>
                    <textarea 
                        {...register("status_note", { required: false })}
                        rows={4}
                        placeholder="记录技术细节、改进建议等..."
                        className="w-full border border-gray-300 rounded-md px-3 py-2 font-sans"
                    />
                </div>
            </div>
        </div>

        {/* Inline Save Button (As requested) */}
        <div style={{ marginTop: 20, textAlign: 'right', marginBottom: 100 }}>
            <button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={submitting}
                style={{
                    padding: '10px 20px',
                    background: '#1677ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: submitting ? 'not-allowed' : 'pointer'
                }}
            >
                {submitting ? '保存中...' : '保存测试记录'}
            </button>
        </div>

        {/* Footer Actions - Always Fixed as requested */}
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 flex justify-end">
            <div className="max-w-4xl w-full mx-auto flex justify-end">
                <button
                    type="button"
                    onClick={openSaveTemplateModal}
                    className="mr-4 w-full md:w-auto bg-white text-blue-600 border border-blue-600 font-bold px-6 py-3 rounded-lg hover:bg-blue-50 shadow-md flex items-center justify-center transition-transform active:scale-95"
                >
                    <Save className="w-5 h-5 mr-2" />
                    保存为模板
                </button>
                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full md:w-auto bg-[#1890ff] text-white font-bold px-8 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 shadow-md flex items-center justify-center transition-transform active:scale-95"
                >
                    {submitting ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            提交中...
                        </>
                    ) : (
                        <>
                            <Save className="w-5 h-5 mr-2" />
                            保存测试记录
                        </>
                    )}
                </button>
            </div>
        </div>
        {/* Floating Save Button (Right Side) */}
        <button
            type="button"
            onClick={() => handleSubmit(onSubmit)()}
            className="fixed right-6 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-all z-40 hidden xl:flex flex-col items-center justify-center gap-1 w-16 h-16"
            title="快捷保存 (Ctrl+S)"
        >
            <Save className="w-6 h-6" />
            <span className="text-[10px] font-bold">保存</span>
        </button>

      </form>
    </div>
  );
}
