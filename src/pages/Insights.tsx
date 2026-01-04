import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "../lib/supabase";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { TrendingUp, Plus, ThumbsUp, Image as ImageIcon, Video, X, Trash2, Users, Clock } from "lucide-react";
import { TrainingInsight } from "../types";

export default function Insights() {
  const { user } = useUser();
  
  // Insights State
  const [insights, setInsights] = useState<TrainingInsight[]>([]);
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [rankingFilter, setRankingFilter] = useState<'week'|'month'|'all'>('week');
  const [topInsights, setTopInsights] = useState<TrainingInsight[]>([]);

  // Media Upload State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{url: string, type: 'image' | 'video'}[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<TrainingInsight | null>(null);

  useEffect(() => {
    if (user) {
      fetchInsights();
      fetchTopInsights();
    }
  }, [user]);

  useEffect(() => {
    fetchTopInsights();
  }, [rankingFilter]);

  async function fetchInsights() {
    // Fetch insights with likes count and user like status
    const { data: insightsData } = await supabase
      .from("training_insights")
      .select("*")
      .order("created_at", { ascending: false });

    if (!insightsData) return;

    // Fetch likes
    const { data: likesData } = await supabase
      .from("insight_likes")
      .select("insight_id, coach_id");

    // Fetch media
    const { data: mediaData } = await supabase
      .from("insight_media")
      .select("*");

    const enrichedInsights = insightsData.map(insight => {
      const likes = likesData?.filter(l => l.insight_id === insight.id) || [];
      const media = mediaData?.filter(m => m.insight_id === insight.id) || [];
      return {
        ...insight,
        likes_count: likes.length,
        is_liked_by_me: likes.some(l => l.coach_id === user?.id),
        media: media
      };
    });

    setInsights(enrichedInsights);
  }

  async function fetchTopInsights() {
    const { data: insightsData } = await supabase
      .from("training_insights")
      .select("*");

    if (!insightsData) return;

    const { data: likesData } = await supabase
      .from("insight_likes")
      .select("insight_id, created_at");

    // Fetch media for top insights as well (needed for modal)
    const { data: mediaData } = await supabase
      .from("insight_media")
      .select("*");

    // Filter likes based on time range
    const now = new Date();
    let cutoff = new Date(0); // All time
    if (rankingFilter === 'week') cutoff = new Date(now.setDate(now.getDate() - 7));
    else if (rankingFilter === 'month') cutoff = new Date(now.setMonth(now.getMonth() - 1));

    const validLikes = likesData?.filter(l => new Date(l.created_at) > cutoff) || [];

    const ranked = insightsData.map(insight => {
      const count = validLikes.filter(l => l.insight_id === insight.id).length;
      const media = mediaData?.filter(m => m.insight_id === insight.id) || [];
      return { 
          ...insight, 
          likes_count: count,
          media: media 
      };
    })
    .sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0))
    .slice(0, 5);

    setTopInsights(ranked);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
        const files = Array.from(e.target.files);
        setSelectedFiles(prev => [...prev, ...files]);
        
        // Generate previews
        const newPreviews = files.map(file => ({
            url: URL.createObjectURL(file),
            type: file.type.startsWith('video') ? 'video' as const : 'image' as const
        }));
        setPreviews(prev => [...prev, ...newPreviews]);
    }
  }

  function removeFile(index: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  }

  async function handlePostInsight(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newTitle || !newContent) return;
    
    setIsUploading(true);

    // 1. Insert Insight
    const { data: insightData, error: insightError } = await supabase
        .from("training_insights")
        .insert([{
            coach_id: user.id,
            title: newTitle,
            content: newContent
        }])
        .select()
        .single();

    if (insightError || !insightData) {
      alert("发布心得失败: " + insightError?.message);
      setIsUploading(false);
      return;
    }

    // 2. Upload Media if any
    if (selectedFiles.length > 0) {
        const mediaInserts = [];
        
        for (const file of selectedFiles) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            
            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('insights')
                .upload(fileName, file);
                
            if (uploadError) {
                console.error("Upload error:", uploadError);
                continue; // Skip failed uploads
            }
            
            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('insights')
                .getPublicUrl(fileName);
                
            mediaInserts.push({
                insight_id: insightData.id,
                type: file.type.startsWith('video') ? 'video' : 'image',
                url: publicUrl
            });
        }
        
        if (mediaInserts.length > 0) {
            const { error: mediaError } = await supabase
                .from("insight_media")
                .insert(mediaInserts);
                
            if (mediaError) console.error("Media insert error:", mediaError);
        }
    }

    setNewTitle("");
    setNewContent("");
    setSelectedFiles([]);
    setPreviews([]);
    setShowInsightModal(false);
    setIsUploading(false);
    fetchInsights();
  }

  async function handleLike(insightId: string, currentStatus: boolean) {
    if (!user) return;

    if (currentStatus) {
      await supabase.from("insight_likes").delete()
        .eq("insight_id", insightId)
        .eq("coach_id", user.id);
    } else {
      await supabase.from("insight_likes").insert([{
        insight_id: insightId,
        coach_id: user.id
      }]);
    }
    
    // Optimistic update or refetch
    fetchInsights();
    fetchTopInsights();
    
    // Also update selectedInsight if it's open
    if (selectedInsight && selectedInsight.id === insightId) {
        setSelectedInsight(prev => prev ? ({
            ...prev,
            is_liked_by_me: !currentStatus,
            likes_count: (prev.likes_count || 0) + (currentStatus ? -1 : 1)
        }) : null);
    }
  }

  async function handleDeleteInsight() {
    if (!selectedInsight || !user) return;
    
    if (!window.confirm("确定删除这条心得吗？删除后不可恢复")) return;

    const { error } = await supabase
        .from("training_insights")
        .delete()
        .eq("id", selectedInsight.id)
        .eq("coach_id", user.id);

    if (error) {
        alert("删除失败: " + error.message);
    } else {
        setSelectedInsight(null);
        fetchInsights();
        fetchTopInsights();
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <TrendingUp className="w-6 h-6 mr-2 text-blue-600" />
          训练心得
        </h1>
        <button 
          onClick={() => setShowInsightModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center text-sm"
        >
          <Plus className="w-4 h-4 mr-1" /> 发布心得
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-4">
          {insights.map(insight => (
              <div 
                  key={insight.id} 
                  className="bg-white rounded-lg shadow-sm border border-gray-100 hover:bg-gray-50 cursor-pointer p-4 transition-colors"
                  onClick={() => setSelectedInsight(insight)}
              >
                  <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-gray-900 mb-1 hover:text-blue-600 transition-colors">
                            {insight.title}
                        </h3>
                        <div className="flex items-center text-xs text-gray-500 space-x-2">
                            <span>教练: {(() => {
                                if (insight.coaches && (insight.coaches.first_name || insight.coaches.last_name)) {
                                    const name = `${insight.coaches.last_name||''}${insight.coaches.first_name||''}`;
                                    return name === '未知教练' ? '教练' : name;
                                }
                                return '教练';
                            })()}</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(insight.created_at), { addSuffix: true, locale: zhCN })}</span>
                        </div>
                    </div>
                    
                    <button 
                        className={`flex items-center space-x-1 text-sm px-2 py-1 rounded-full ${insight.is_liked_by_me ? 'text-blue-600 bg-blue-50' : 'text-gray-400 bg-gray-50'}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleLike(insight.id, insight.is_liked_by_me || false);
                        }}
                    >
                        <ThumbsUp className={`w-4 h-4 ${insight.is_liked_by_me ? 'fill-current' : ''}`} />
                        <span>{insight.likes_count || 0}</span>
                    </button>
                  </div>
              </div>
            ))}
            {insights.length === 0 && (
              <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-dashed border-gray-200">
                暂无心得，分享您的第一条经验吧！
              </div>
            )}
        </div>

        {/* Sidebar Ranking */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900">心得热度榜</h3>
              <div className="flex text-xs bg-gray-100 rounded p-1">
                <button 
                  onClick={() => setRankingFilter('week')}
                  className={`px-2 py-1 rounded ${rankingFilter === 'week' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                >
                  本周
                </button>
                <button 
                  onClick={() => setRankingFilter('month')}
                  className={`px-2 py-1 rounded ${rankingFilter === 'month' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                >
                  本月
                </button>
                <button 
                  onClick={() => setRankingFilter('all')}
                  className={`px-2 py-1 rounded ${rankingFilter === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                >
                  总榜
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              {topInsights.map((insight, index) => (
                <div 
                    key={insight.id} 
                    className="flex items-start space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                    onClick={() => setSelectedInsight(insight)}
                >
                  <span className={`
                    flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold
                    ${index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                      index === 1 ? 'bg-gray-100 text-gray-700' : 
                      index === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-400'}
                  `}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate hover:text-blue-600 transition-colors">{insight.title}</p>
                    <p className="text-xs text-gray-500 truncate">教练: {insight.coach_id.slice(0, 8)}...</p>
                  </div>
                  <div className="flex items-center text-xs text-gray-400">
                    <ThumbsUp className="w-3 h-3 mr-1" />
                    {insight.likes_count}
                  </div>
                </div>
              ))}
              {topInsights.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">暂无数据</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Insight Detail Modal */}
      {selectedInsight && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-start sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedInsight.title}</h2>
                <div className="flex items-center text-sm text-gray-500 space-x-3">
                  <span className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {selectedInsight.coaches ? `${selectedInsight.coaches.last_name||''}${selectedInsight.coaches.first_name||''}` : `${selectedInsight.coach_id.slice(0, 8)}...`}
                  </span>
                  <span>•</span>
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {format(new Date(selectedInsight.created_at), 'yyyy年MM月dd日 HH:mm')}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                  {selectedInsight.coach_id === user?.id && (
                      <button 
                        onClick={handleDeleteInsight}
                        className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                        title="删除心得"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                  )}
                  <button 
                    onClick={() => setSelectedInsight(null)}
                    className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <p className="text-gray-700 whitespace-pre-wrap text-lg leading-relaxed mb-8">
                {selectedInsight.content}
              </p>

              {/* Media Grid */}
              {selectedInsight.media && selectedInsight.media.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">附件媒体</h3>
                    <div className={`grid gap-3 ${
                        selectedInsight.media.length === 1 ? 'grid-cols-1' : 
                        selectedInsight.media.length === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'
                    }`}>
                      {selectedInsight.media.map(m => (
                        <div key={m.id} className="relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200 aspect-square group shadow-sm">
                          {m.type === 'image' ? (
                            <div className="w-full h-full relative cursor-zoom-in" onClick={() => window.open(m.url, '_blank')}>
                                <img 
                                    src={m.url} 
                                    alt="Insight media" 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <span className="bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">点击放大</span>
                                </div>
                            </div>
                          ) : (
                            <video 
                                src={m.url} 
                                controls 
                                preload="metadata"
                                className="w-full h-full object-contain bg-black"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end sticky bottom-0">
                <button 
                    onClick={() => handleLike(selectedInsight.id, selectedInsight.is_liked_by_me || false)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all ${
                        selectedInsight.is_liked_by_me 
                        ? 'bg-blue-100 text-blue-700 font-medium' 
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <ThumbsUp className={`w-5 h-5 ${selectedInsight.is_liked_by_me ? 'fill-current' : ''}`} />
                    <span>{selectedInsight.likes_count || 0}</span>
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Modal */}
      {showInsightModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold mb-4">发布训练心得</h2>
            <form onSubmit={handlePostInsight}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="一句话概括核心观点"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">正文</label>
                <textarea
                  required
                  rows={5}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="分享您的训练技巧、教学经验或学员案例..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Media Upload Area */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">上传媒体 (图片/视频)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition-colors relative">
                  <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={handleFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={isUploading}
                  />
                  <div className="flex flex-col items-center justify-center text-gray-500">
                      <div className="flex space-x-2 mb-2">
                          <ImageIcon className="w-6 h-6" />
                          <Video className="w-6 h-6" />
                      </div>
                      <p className="text-sm">点击或拖拽上传</p>
                      <p className="text-xs text-gray-400 mt-1">支持多张图片或60秒内短视频</p>
                  </div>
                </div>
                
                {/* Previews */}
                {previews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-4">
                      {previews.map((preview, idx) => (
                          <div key={idx} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200 group">
                              {preview.type === 'image' ? (
                                  <img src={preview.url} className="w-full h-full object-cover" />
                              ) : (
                                  <video src={preview.url} className="w-full h-full object-cover" />
                              )}
                              <button
                                  type="button"
                                  onClick={() => removeFile(idx)}
                                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                  <X className="w-3 h-3" />
                              </button>
                          </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInsightModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                  disabled={isUploading}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-dolphin-gold text-dolphin-blue font-bold rounded-md hover:bg-yellow-400 flex items-center shadow-sm"
                  disabled={isUploading}
                >
                  {isUploading ? '发布中...' : '发布'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
