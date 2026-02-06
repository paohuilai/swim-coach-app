import { useParams } from 'react-router-dom';
import AbilityRadar from '../../components/national/AbilityRadar';
import PerformanceTrend from '../../components/national/PerformanceTrend';
import { User, Activity, HeartPulse, Trophy } from 'lucide-react';

export default function AthleteProfile() {
  const { id } = useParams();

  return (
    <div className="space-y-6">
      {/* Header Profile Card */}
      <div className="bg-white rounded-xl shadow-lg border-l-4 border-brand-gold overflow-hidden">
         <div className="bg-brand-blue h-24 relative">
             <div className="absolute -bottom-10 left-8">
                 <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" className="w-24 h-24 rounded-full border-4 border-white bg-white shadow-md" alt="Avatar" />
             </div>
         </div>
         <div className="pt-12 px-8 pb-6">
             <div className="flex justify-between items-start">
                 <div>
                     <h1 className="text-2xl font-bold text-gray-900">潘展乐</h1>
                     <p className="text-gray-500">主项: 100m 自由泳 | 级别: 国际健将</p>
                 </div>
                 <div className="flex gap-2">
                     <span className="px-3 py-1 bg-brand-gold/20 text-brand-dark rounded-full text-sm font-bold">状态: 备战期</span>
                 </div>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
                 <div className="flex items-center gap-3">
                     <div className="bg-blue-50 p-2 rounded-lg text-brand-blue"><Trophy className="w-5 h-5" /></div>
                     <div>
                         <div className="text-xs text-gray-500">最好成绩</div>
                         <div className="font-bold">46.80s (WR)</div>
                     </div>
                 </div>
                 <div className="flex items-center gap-3">
                     <div className="bg-green-50 p-2 rounded-lg text-green-600"><HeartPulse className="w-5 h-5" /></div>
                     <div>
                         <div className="text-xs text-gray-500">晨脉</div>
                         <div className="font-bold">42 bpm</div>
                     </div>
                 </div>
                 <div className="flex items-center gap-3">
                     <div className="bg-purple-50 p-2 rounded-lg text-purple-600"><Activity className="w-5 h-5" /></div>
                     <div>
                         <div className="text-xs text-gray-500">本周负荷</div>
                         <div className="font-bold">850 km</div>
                     </div>
                 </div>
                 <div className="flex items-center gap-3">
                     <div className="bg-orange-50 p-2 rounded-lg text-orange-600"><User className="w-5 h-5" /></div>
                     <div>
                         <div className="text-xs text-gray-500">体重</div>
                         <div className="font-bold">80 kg</div>
                     </div>
                 </div>
             </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-l-4 border-brand-blue pl-3">能力六维图</h2>
              <AbilityRadar />
          </div>

          {/* Trend Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-l-4 border-brand-gold pl-3">成绩与负荷趋势</h2>
              <PerformanceTrend />
          </div>
      </div>
      
      {/* Recent Training */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">近期训练重点</h2>
          <div className="space-y-4">
              {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100">
                      <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0 mr-4 flex items-center justify-center text-gray-500 font-bold">
                          1.{20+i}
                      </div>
                      <div className="flex-1">
                          <h4 className="font-bold text-gray-900">高强度间歇训练 (HIIT)</h4>
                          <p className="text-sm text-gray-500">重点提升后程冲刺能力，控制划频在 50spm 以上。</p>
                      </div>
                      <span className="text-brand-blue font-medium text-sm">查看详情</span>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
}
