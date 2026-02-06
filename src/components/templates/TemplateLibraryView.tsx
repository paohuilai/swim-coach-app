import { useState, useEffect, useMemo } from 'react';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useCoachProfile } from '../../hooks/useCoachProfile';
import MediaUploader from '../MediaUploader';
import { 
  Search, Plus, Copy, Heart, Star, Loader2, BookOpen, 
  Filter, TrendingUp, Clock, User, X, Save, Image as ImageIcon, Film
} from 'lucide-react';
import { TRAINING_TEMPLATES } from '../../constants/templates';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface TemplateLibraryViewProps {
  onUseTemplate: (template: {title: string, content: string, media_urls?: string[]}) => void;
  coachId?: string;
}

export default function TemplateLibraryView({ onUseTemplate, coachId }: TemplateLibraryViewProps) {
  const { getClient } = useSupabaseAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [dbTemplates, setDbTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'my'>('all');
  const [activeAgeGroup, setActiveAgeGroup] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('popular');

  // CRUD States
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorGroups, setEditorGroups] = useState<string[]>([]); // Multi-select
  const [editorMedia, setEditorMedia] = useState<string[]>([]); // Media
  const [saving, setSaving] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState<any>(null); // For detail view
  
  // Interaction States
  const [likedTemplateIds, setLikedTemplateIds] = useState<Set<string>>(new Set());
  const [favoritedTemplateIds, setFavoritedTemplateIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTemplates();
    fetchInteractions();
  }, [coachId, activeTab, activeAgeGroup, sortBy]);

  const fetchTemplates = async () => {
    if (!coachId) return;
    setLoading(true);
    try {
      const client = await getClient();
      let query = client
        .from('training_plan_templates')
        .select(`*`); 
        // Temporarily removed relationship query 'coach:coaches(...)' to fix PGRST200 error
        // Re-enable this after Foreign Key is added in DB:
        // .select(`*, coach:coaches(first_name, last_name)`);

      // Filter by Age Group (Supports multi-select / array overlap)
      if (activeAgeGroup !== 'all') {
          // Use 'cs' (contains) operator for array column `target_groups`
          // Assuming `target_groups` is text[] or jsonb in DB
          // If stored as comma-separated string in `age_group`, we use ilike
          // But based on my update, we use `target_groups` array.
          // However, Supabase PostgREST for array column contains is: .cs.{val}
          // Client SDK: .contains('target_groups', [activeAgeGroup])
          query = query.contains('target_groups', [activeAgeGroup]);
      }

      // Filter by Tab
      if (activeTab === 'my') {
        // If coachId is not passed correctly or we use anon client, this might fail if we rely on RLS to filter "my"
        // But here we explicitly query.
        // Important: coachId prop comes from parent.
        query = query.eq('coach_id', coachId);
      } else if (activeTab === 'favorites') {
        const { data: favs } = await client
            .from('template_favorites')
            .select('template_id')
            .eq('coach_id', coachId);
        
        if (favs && favs.length > 0) {
            query = query.in('id', favs.map(f => f.template_id));
        } else {
            setDbTemplates([]);
            setLoading(false);
            return;
        }
      }

      // Sort
      if (sortBy === 'popular') {
        query = query.order('likes_count', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      setDbTemplates(data || []);

    } catch (e) {
      console.error('Fetch templates error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInteractions = async () => {
      if (!coachId) return;
      const client = await getClient();
      // Fetch Likes
      const { data: likes } = await client
        .from('template_likes')
        .select('template_id')
        .eq('coach_id', coachId);
      if (likes) setLikedTemplateIds(new Set(likes.map(l => l.template_id)));

      // Fetch Favorites
      const { data: favs } = await client
        .from('template_favorites')
        .select('template_id')
        .eq('coach_id', coachId);
      if (favs) setFavoritedTemplateIds(new Set(favs.map(f => f.template_id)));
  };

  const handleLike = async (e: React.MouseEvent, templateId: string) => {
      e.stopPropagation();
      if (!coachId) return;
      const client = await getClient();
      const isLiked = likedTemplateIds.has(templateId);
      
      // Optimistic Update
      setLikedTemplateIds(prev => {
          const next = new Set(prev);
          isLiked ? next.delete(templateId) : next.add(templateId);
          return next;
      });
      setDbTemplates(prev => prev.map(t => {
          if (t.id === templateId) {
              return { ...t, likes_count: (t.likes_count || 0) + (isLiked ? -1 : 1) };
          }
          return t;
      }));

      try {
          if (isLiked) {
              await client.from('template_likes').delete().match({ template_id: templateId, coach_id: coachId });
          } else {
              await client.from('template_likes').insert({ template_id: templateId, coach_id: coachId });
          }
      } catch (e) {
          console.error('Like error:', e);
          fetchTemplates(); // Revert on error
      }
  };

  const handleFavorite = async (e: React.MouseEvent, templateId: string) => {
      e.stopPropagation();
      if (!coachId) return;
      const client = await getClient();
      const isFavorited = favoritedTemplateIds.has(templateId);
      
      // Optimistic Update
      setFavoritedTemplateIds(prev => {
          const next = new Set(prev);
          isFavorited ? next.delete(templateId) : next.add(templateId);
          return next;
      });

      try {
          if (isFavorited) {
              await client.from('template_favorites').delete().match({ template_id: templateId, coach_id: coachId });
          } else {
              await client.from('template_favorites').insert({ template_id: templateId, coach_id: coachId });
          }
          if (activeTab === 'favorites' && isFavorited) {
              // Remove from view if in favorites tab
              setDbTemplates(prev => prev.filter(t => t.id !== templateId));
          }
      } catch (e) {
          console.error('Favorite error:', e);
      }
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, templateId: string) => {
      e.stopPropagation();
      if (!confirm('确定删除此模板吗？')) return;
      
      try {
          const client = await getClient();
          const { error } = await client
              .from('training_plan_templates')
              .delete()
              .eq('id', templateId)
              .eq('coach_id', coachId); // Security check
          
          if (error) throw error;
          
          setDbTemplates(prev => prev.filter(t => t.id !== templateId));
      } catch (e: any) {
          console.error('Delete error:', e);
          alert('删除失败: ' + e.message);
      }
  };

  const handleSaveTemplate = async () => {
      if (!editorTitle.trim() || !editorContent.trim()) {
          alert('标题和内容不能为空');
          return;
      }
      if (editorGroups.length === 0) {
          alert('请至少选择一个适用年龄组');
          return;
      }
      setSaving(true);
      try {
          const client = await getClient();
          const payload = {
              coach_id: coachId,
              title: editorTitle.trim(),
              content: editorContent,
              age_group: editorGroups.join(','),
              target_groups: editorGroups,
              media_urls: editorMedia,
              type: 'user'
          };

          if (editingTemplate) {
              // Update
              const { error } = await client
                  .from('training_plan_templates')
                  .update(payload)
                  .eq('id', editingTemplate.id)
                  .eq('coach_id', coachId); // Security check
              if (error) throw error;
          } else {
              // Create
              const { error } = await client
                  .from('training_plan_templates')
                  .insert(payload);
              if (error) throw error;
          }
          
          alert('模板保存成功！');
          setShowEditor(false);
          setEditingTemplate(null);
          fetchTemplates();
      } catch (e: any) {
          console.error('Save template error:', e);
          alert('保存失败: ' + e.message);
      } finally {
          setSaving(false);
      }
  };

  const openEditor = (template?: any) => {
      // Prevent event bubbling if triggered from list item click (though usually button click)
      if (template) {
          setEditingTemplate(template);
          setEditorTitle(template.title);
          setEditorContent(template.content);
          setEditorGroups(template.target_groups || (template.age_group ? [template.age_group] : []));
          setEditorMedia(template.media_urls || []);
      } else {
          setEditingTemplate(null);
          setEditorTitle('');
          setEditorContent('');
          setEditorGroups([]); // Force selection
          setEditorMedia([]);
      }
      setShowEditor(true);
  };
  
  const openDetail = (template: any) => {
      setSelectedTemplate(template);
  };
  
  const toggleEditorGroup = (group: string) => {
      setEditorGroups(prev => 
          prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
      );
  };

  // Merge system templates if showing 'all' and no search term (or match)
  const displayTemplates = useMemo(() => {
      let list = [...dbTemplates];
      
      // Removed system templates as requested
      /* 
      // Add system templates only in 'all' tab
      if (activeTab === 'all') {
          // ... system templates code removed
      }
      */

      if (searchTerm) {
          list = list.filter(t => 
            t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
            t.content?.toLowerCase().includes(searchTerm.toLowerCase())
          );
      }

      return list;
  }, [dbTemplates, activeTab, searchTerm, sortBy, activeAgeGroup]);


  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col gap-4">
        {/* Top Row: Search and Age Group */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            {/* Search */}
            <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input 
                type="text" 
                placeholder="搜索模板..." 
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
            </div>

            {/* Age Group Filter */}
            <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                {['all', '2020组', '2019组', '2018组', '2017组'].map(group => (
                    <button
                        key={group}
                        onClick={() => setActiveAgeGroup(group)}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap",
                            activeAgeGroup === group 
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        )}
                    >
                        {group === 'all' ? '全部年龄组' : group}
                    </button>
                ))}
            </div>
        </div>

        {/* Bottom Row: Tabs and Sort */}
        <div className="flex gap-2 w-full overflow-x-auto pb-1 md:pb-0 justify-between">
          <div className="flex bg-gray-100 p-1 rounded-lg">
             <button 
                onClick={() => setActiveTab('all')}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all", activeTab === 'all' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
             >
                全部模板
             </button>
             <button 
                onClick={() => setActiveTab('favorites')}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1", activeTab === 'favorites' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
             >
                <Star className="w-3 h-3" />
                我的收藏
             </button>
             <button 
                onClick={() => setActiveTab('my')}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1", activeTab === 'my' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
             >
                <User className="w-3 h-3" />
                我发布的
             </button>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-lg">
             <button 
                onClick={() => setSortBy('popular')}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1", sortBy === 'popular' ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
             >
                <TrendingUp className="w-3 h-3" />
                热度榜
             </button>
             <button 
                onClick={() => setSortBy('newest')}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1", sortBy === 'newest' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
             >
                <Clock className="w-3 h-3" />
                最新发布
             </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {/* Create New Card - Only in 'all' or 'my' tab */}
           {activeTab !== 'favorites' && (
               <div 
                  onClick={() => openEditor()}
                  className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer flex flex-col items-center justify-center text-gray-500 hover:text-blue-600 group min-h-[200px]"
               >
                  <div className="bg-gray-100 p-4 rounded-full mb-4 group-hover:bg-blue-100 transition-colors">
                     <Plus className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-lg">新建模板</h3>
                  <p className="text-sm mt-2 opacity-80">创建并分享你的训练计划</p>
               </div>
           )}

           {displayTemplates.map((template) => (
               <div 
                  key={template.id} 
                  className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col overflow-hidden group relative cursor-pointer"
                  onClick={() => openDetail(template)}
               >
                   {/* Header */}
                   <div className="p-4 border-b border-gray-50 bg-gradient-to-r from-gray-50 to-white flex justify-between items-start">
                       <div>
                           <h3 className="font-bold text-gray-900 line-clamp-1" title={template.title}>{template.title}</h3>
                           <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                               <span className="flex items-center gap-1">
                                   <User className="w-3 h-3" />
                                   {/* Fallback display since relation query is disabled */}
                                   {template.coach?.last_name || ''}{template.coach?.first_name || '教练'}
                               </span>
                               <span>•</span>
                               <span>{template.type === 'system' ? '系统预设' : formatDistanceToNow(new Date(template.created_at), { addSuffix: true, locale: zhCN })}</span>
                           </div>
                       </div>
                       {template.type !== 'system' && (
                           <div className="flex gap-1">
                               <button 
                                  onClick={(e) => handleFavorite(e, template.id)}
                                  className={cn("p-1.5 rounded-full transition-colors", favoritedTemplateIds.has(template.id) ? "bg-yellow-50 text-yellow-500" : "hover:bg-gray-100 text-gray-400")}
                               >
                                   <Star className={cn("w-4 h-4", favoritedTemplateIds.has(template.id) && "fill-current")} />
                               </button>
                           </div>
                       )}
                   </div>

                   {/* Content Preview */}
                   <div className="p-4 flex-grow bg-gray-50/50 relative">
                       <div className="absolute top-2 right-2 flex flex-wrap gap-1 justify-end max-w-[70%]">
                           {template.target_groups?.map((g: string) => (
                               <span key={g} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full whitespace-nowrap">
                                   {g}
                               </span>
                           )) || (
                               <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full">
                                   {template.age_group || '通用'}
                               </span>
                           )}
                       </div>
                       <div className="text-sm text-gray-600 font-mono whitespace-pre-wrap line-clamp-6 h-32 overflow-hidden relative mt-4">
                           {template.content}
                           <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-gray-50 to-transparent"></div>
                       </div>

                       {/* Media Preview Badge */}
                       {template.media_urls && template.media_urls.length > 0 && (
                           <div className="absolute bottom-4 right-4 flex gap-1">
                               {template.media_urls.some((u: string) => u.match(/\.(mp4|mov|webm)$/i)) && (
                                   <div className="bg-black/50 text-white p-1 rounded-full backdrop-blur-sm" title="包含视频">
                                       <Film className="w-3 h-3" />
                                   </div>
                               )}
                               <div className="bg-black/50 text-white p-1 rounded-full backdrop-blur-sm flex items-center gap-1 text-[10px] px-2" title="包含图片">
                                   <ImageIcon className="w-3 h-3" />
                                   <span>{template.media_urls.length}</span>
                               </div>
                           </div>
                       )}
                   </div>

                   {/* Footer Actions */}
                   <div className="p-3 border-t border-gray-100 flex items-center justify-between bg-white">
                       <div className="flex items-center gap-3">
                           <button 
                              onClick={(e) => template.type !== 'system' && handleLike(e, template.id)}
                              className={cn("flex items-center gap-1 text-xs font-medium transition-colors", 
                                  likedTemplateIds.has(template.id) ? "text-red-500" : "text-gray-500 hover:text-red-500"
                              )}
                              disabled={template.type === 'system'}
                           >
                               <Heart className={cn("w-4 h-4", likedTemplateIds.has(template.id) && "fill-current")} />
                               <span>{template.likes_count || 0}</span>
                           </button>
                       </div>
                       <div className="flex gap-2">
                           {template.coach_id === coachId && (
                               <>
                                   <button 
                                      onClick={(e) => handleDeleteTemplate(e, template.id)}
                                      className="text-gray-400 hover:text-red-600 px-2 text-xs flex items-center gap-1"
                                   >
                                       <X className="w-3 h-3" />
                                       删除
                                   </button>
                                   <button 
                                      onClick={(e) => { e.stopPropagation(); openEditor(template); }}
                                      className="text-gray-400 hover:text-blue-600 px-2 text-xs"
                                   >
                                       编辑
                                   </button>
                               </>
                           )}
                           <button 
                               onClick={(e) => { e.stopPropagation(); onUseTemplate(template); }}
                               className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                           >
                               <Copy className="w-3 h-3" />
                               使用
                           </button>
                       </div>
                   </div>
               </div>
           ))}
        </div>
      )}

      {/* Template Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="font-bold text-lg">{editingTemplate ? '编辑模板' : '新建模板'}</h3>
                    <button onClick={() => setShowEditor(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">模板标题</label>
                        <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="例如：周一基础耐力训练"
                            value={editorTitle}
                            onChange={e => setEditorTitle(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">适用年龄组 (多选) <span className="text-red-500">*</span></label>
                        <div className="flex gap-2 flex-wrap">
                            {['2020组', '2019组', '2018组', '2017组', '2016组', '2015组'].map(group => (
                                <button
                                    key={group}
                                    onClick={() => toggleEditorGroup(group)}
                                    className={cn(
                                        "px-3 py-1.5 text-xs rounded-full border transition-all",
                                        editorGroups.includes(group)
                                            ? "bg-blue-100 text-blue-700 border-blue-500" 
                                            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                                    )}
                                >
                                    {group}
                                </button>
                            ))}
                        </div>
                        {editorGroups.length === 0 && <p className="text-xs text-red-500 mt-1">必须至少选择一个年龄组</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">训练内容</label>
                        <textarea 
                            className="w-full border border-gray-300 rounded-md px-3 py-2 h-40 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                            placeholder="输入详细训练计划..."
                            value={editorContent}
                            onChange={e => setEditorContent(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">多媒体附件 (图片/视频)</label>
                        <MediaUploader 
                            files={editorMedia} 
                            onFilesChange={setEditorMedia} 
                        />
                    </div>
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button 
                        onClick={() => setShowEditor(false)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleSaveTemplate}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center"
                    >
                        {saving && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                        保存模板
                    </button>
                </div>
            </div>
        </div>
      )}
      {/* Template Detail Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTemplate(null)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="font-bold text-xl text-gray-900">{selectedTemplate.title}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {selectedTemplate.coach?.last_name || ''}{selectedTemplate.coach?.first_name || '教练'}
                            </span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(selectedTemplate.created_at), { addSuffix: true, locale: zhCN })}</span>
                        </div>
                    </div>
                    <button onClick={() => setSelectedTemplate(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content Scrollable */}
                <div className="p-6 overflow-y-auto flex-grow space-y-6">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-2">
                        {selectedTemplate.target_groups?.map((g: string) => (
                            <span key={g} className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                {g}
                            </span>
                        )) || (
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                {selectedTemplate.age_group || '通用'}
                            </span>
                        )}
                    </div>

                    {/* Text Content */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <pre className="text-sm text-gray-700 font-mono whitespace-pre-wrap leading-relaxed">
                            {selectedTemplate.content}
                        </pre>
                    </div>

                    {/* Media Gallery */}
                    {selectedTemplate.media_urls && selectedTemplate.media_urls.length > 0 && (
                        <div>
                            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4" />
                                多媒体附件
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {selectedTemplate.media_urls.map((url: string, index: number) => (
                                    <div key={index} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-black aspect-square">
                                        {url.match(/\.(mp4|mov|webm)$/i) ? (
                                            <video 
                                                src={url} 
                                                controls 
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <img 
                                                src={url} 
                                                alt={`Attachment ${index + 1}`} 
                                                className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                                                onClick={() => window.open(url, '_blank')}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button 
                        onClick={() => setSelectedTemplate(null)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-md text-sm font-medium"
                    >
                        关闭
                    </button>
                    <button 
                        onClick={() => { onUseTemplate(selectedTemplate); setSelectedTemplate(null); }}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-bold hover:bg-blue-700 shadow-md flex items-center gap-2"
                    >
                        <Copy className="w-4 h-4" />
                        使用此模板
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
