import { useState, useEffect } from 'react';
import GanttChart from '../../components/national/GanttChart';
import { Plus, Filter, AlertTriangle } from 'lucide-react';
import { NationalService } from '../../services/nationalService';
import { NationalTask } from '../../types';

export default function CommandCenter() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTasks() {
        try {
            const data = await NationalService.getTasks();
            const formatted = data.map(t => ({
                id: t.id,
                name: t.title,
                start: t.created_at, // Mock start as created_at
                end: t.deadline,
                owner: t.assignee_role || '未分配',
                status: t.status
            }));
            setTasks(formatted);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }
    loadTasks();
  }, []);

  // Use dummy data if DB is empty for visualization
  const displayTasks = tasks.length > 0 ? tasks : [
    { id: '1', name: '冬训体能摸底', start: '2024-01-10', end: '2024-01-15', owner: '王教练', status: 'completed' as const },
    { id: '2', name: '专项技术分析', start: '2024-01-12', end: '2024-01-20', owner: '李科研', status: 'in_progress' as const },
    { id: '3', name: '膳食营养调整', start: '2024-01-18', end: '2024-01-25', owner: '张队医', status: 'pending' as const },
    { id: '4', name: '奥运选拔赛预案', start: '2024-02-01', end: '2024-02-15', owner: '主教练', status: 'pending' as const },
    { id: '5', name: '器材维护', start: '2024-01-05', end: '2024-01-08', owner: '后勤组', status: 'overdue' as const },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-brand-dark">任务协同指挥台</h1>
            <p className="text-sm text-gray-500">National Team Command Center</p>
        </div>
        <button className="bg-brand-blue text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-800 transition-colors shadow-lg">
            <Plus className="w-4 h-4" />
            发布任务
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-brand-blue">
            <div className="text-gray-500 text-sm">进行中任务</div>
            <div className="text-2xl font-bold text-brand-dark">12</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-status-warning">
            <div className="text-gray-500 text-sm">即将截止</div>
            <div className="text-2xl font-bold text-status-warning">3</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-status-danger">
            <div className="text-gray-500 text-sm">已逾期</div>
            <div className="text-2xl font-bold text-status-danger">1</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-status-success">
            <div className="text-gray-500 text-sm">本周完成</div>
            <div className="text-2xl font-bold text-status-success">8</div>
        </div>
      </div>

      {/* Gantt Chart Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">任务全景图</h2>
            <div className="flex gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><Filter className="w-4 h-4" /></button>
            </div>
        </div>
        <GanttChart tasks={displayTasks} />
      </div>

      {/* Task List Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">任务列表</h2>
        </div>
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">任务名称</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">负责人</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">周期</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">状态</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">操作</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {displayTasks.map(task => (
                        <tr key={task.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{task.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                                        {task.owner[0]}
                                    </div>
                                    {task.owner}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {task.start} ~ {task.end}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    task.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    task.status === 'overdue' ? 'bg-red-100 text-red-800' :
                                    task.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                    {task.status === 'completed' ? '已完成' :
                                     task.status === 'overdue' ? '已逾期' :
                                     task.status === 'in_progress' ? '进行中' : '待处理'}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-brand-blue hover:underline cursor-pointer">
                                详情
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
