import { useState } from 'react';
import { NationalService } from '../../services/nationalService';
import { Play, Clock, CheckCircle, AlertTriangle, Settings } from 'lucide-react';

export default function AutomationConfig() {
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleRunOverdueCheck = async () => {
    setLoading(true);
    setStatus('idle');
    try {
      await NationalService.triggerOverdueCheck();
      setLastRun(new Date().toLocaleString());
      setStatus('success');
    } catch (error) {
      console.error(error);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-brand-dark">自动化规则配置</h1>
            <p className="text-sm text-gray-500">Automation Rules & Triggers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Overdue Task Monitor */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg text-brand-blue">
                          <Clock className="w-6 h-6" />
                      </div>
                      <div>
                          <h3 className="font-bold text-gray-800">任务逾期监控</h3>
                          <p className="text-xs text-gray-500">每日 00:00 自动执行</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">已启用</span>
                      <Settings className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600" />
                  </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-6">
                  自动扫描所有状态为 "进行中" 且截止时间已过的任务，将其状态更新为 "已逾期" (Overdue)。
              </p>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-6">
                  <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">上次执行:</span>
                      <span className="font-medium text-gray-900">{lastRun || '暂无记录'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                      <span className="text-gray-500">执行结果:</span>
                      <span className={`font-medium ${status === 'success' ? 'text-green-600' : status === 'error' ? 'text-red-600' : 'text-gray-900'}`}>
                          {status === 'success' ? '成功' : status === 'error' ? '失败' : '-'}
                      </span>
                  </div>
              </div>

              <button 
                onClick={handleRunOverdueCheck}
                disabled={loading}
                className="w-full bg-brand-blue text-white py-2 rounded-lg font-medium hover:bg-blue-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                  {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ) : (
                      <Play className="w-4 h-4" />
                  )}
                  立即执行
              </button>
          </div>

          {/* Card 2: Load Warning (Placeholder) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 opacity-75">
              <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                      <div className="bg-yellow-100 p-2 rounded-lg text-yellow-700">
                          <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div>
                          <h3 className="font-bold text-gray-800">负荷超标预警</h3>
                          <p className="text-xs text-gray-500">实时触发</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full font-medium">开发中</span>
                  </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-6">
                  当教练提交的训练计划总负荷 (TRIMP) 超过运动员当前周期的最大承受阈值时，自动发送系统通知。
              </p>

              <button disabled className="w-full bg-gray-100 text-gray-400 py-2 rounded-lg font-medium cursor-not-allowed">
                  配置规则
              </button>
          </div>
      </div>
    </div>
  );
}
