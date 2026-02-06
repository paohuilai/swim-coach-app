import { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DraggablePlanItem } from '../../components/national/DraggablePlanItem';
import { Plus, Save, AlertTriangle, Zap } from 'lucide-react';
import { NationalService } from '../../services/nationalService';
import { TrainingModule } from '../../types';
import { useCoachProfile } from '../../hooks/useCoachProfile';

export default function SmartPlan() {
  const { profile } = useCoachProfile();
  const [items, setItems] = useState<TrainingModule[]>([
    { id: '1', content: '陆上热身：核心激活 (20min)', load: 30 },
    { id: '2', content: '水上热身：800m 混合泳分解', load: 40 },
    { id: '3', content: '主项：10x100m 自由泳包干 (1:10)', load: 85 },
    { id: '4', content: '技术游：200m 划水次数控制', load: 20 },
    { id: '5', content: '放松：400m 慢游', load: 10 },
  ]);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const totalLoad = items.reduce((acc, item) => acc + item.load, 0);
  const LOAD_LIMIT = 180;
  const isOverload = totalLoad > LOAD_LIMIT;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  function handleRemove(id: string) {
      setItems(items.filter(i => i.id !== id));
  }

  function handleAdd() {
      const id = Math.random().toString(36).substr(2, 9);
      setItems([...items, { id, content: '新训练模块', load: 20 }]);
  }

  async function handleSave() {
      if (!profile?.id) {
          alert("请先登录");
          return;
      }
      
      setSaving(true);
      try {
          await NationalService.createPlan({
              title: `训练计划 - ${new Date().toLocaleDateString()}`,
              coach_id: profile.id,
              start_date: new Date().toISOString(),
              end_date: new Date().toISOString(),
              modules: items,
              total_load: totalLoad,
              status: 'published'
          });
          alert("计划已保存到云端");
      } catch (err) {
          console.error(err);
          alert("保存失败");
      } finally {
          setSaving(false);
      }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
        {/* Left: Plan Builder */}
        <div className="lg:col-span-2 flex flex-col space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-brand-dark">智能训练计划</h1>
                    <p className="text-sm text-gray-500">Smart Training Plan Builder</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleAdd} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50">
                        <Plus className="w-4 h-4" />
                        添加模块
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="bg-brand-blue text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-800 shadow-lg disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? '保存中...' : '保存计划'}
                    </button>
                </div>
            </div>

            <div className="bg-gray-100 p-4 rounded-xl flex-1 overflow-y-auto border border-gray-200">
                <DndContext 
                    sensors={sensors} 
                    collisionDetection={closestCenter} 
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext 
                        items={items.map(i => i.id)} 
                        strategy={verticalListSortingStrategy}
                    >
                        {items.map(item => (
                            <DraggablePlanItem 
                                key={item.id} 
                                id={item.id} 
                                content={item.content} 
                                load={item.load}
                                onRemove={handleRemove}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
                {items.length === 0 && (
                    <div className="text-center text-gray-400 py-20">
                        拖入模块或点击添加开始编排
                    </div>
                )}
            </div>
        </div>

        {/* Right: Load Monitor */}
        <div className="space-y-6">
            <div className={`p-6 rounded-xl border shadow-sm transition-all ${isOverload ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Zap className={`w-5 h-5 ${isOverload ? 'text-red-500' : 'text-brand-gold'}`} />
                    负荷监控
                </h2>
                
                <div className="flex items-end gap-2 mb-2">
                    <span className={`text-4xl font-bold ${isOverload ? 'text-red-600' : 'text-brand-blue'}`}>{totalLoad}</span>
                    <span className="text-gray-500 mb-1">/ {LOAD_LIMIT} (TRIMP)</span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
                    <div 
                        className={`h-3 rounded-full transition-all duration-500 ${isOverload ? 'bg-red-500' : 'bg-brand-blue'}`} 
                        style={{ width: `${Math.min((totalLoad / LOAD_LIMIT) * 100, 100)}%` }}
                    ></div>
                </div>

                {isOverload ? (
                    <div className="flex items-start gap-2 text-red-700 text-sm bg-red-100 p-3 rounded-lg">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <span>当前计划负荷已超过本日建议上限，建议减少主项强度或增加恢复游。</span>
                    </div>
                ) : (
                    <div className="text-sm text-gray-600">
                        当前负荷处于合理区间，符合周期训练要求。
                    </div>
                )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4">强度分布</h3>
                <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">有氧耐力 (A1/A2)</span>
                        <span className="font-medium">45%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">无氧阈 (AT)</span>
                        <span className="font-medium">30%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '30%' }}></div>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">最大摄氧量 (VO2)</span>
                        <span className="font-medium">25%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-red-500 h-2 rounded-full" style={{ width: '25%' }}></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
