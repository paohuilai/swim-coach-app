import { useState } from 'react';
import PerformanceRanking from './PerformanceRanking';
import CompetitionRanking from './CompetitionRanking';

export default function Ranking() {
  const [activeTab, setActiveTab] = useState<'performance' | 'competition'>('performance');

  return (
    <div className="space-y-6">
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          className={`py-2 px-4 border-b-2 font-medium text-sm ${
            activeTab === 'performance'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('performance')}
        >
          测试成绩排名
        </button>
        <button
          className={`py-2 px-4 border-b-2 font-medium text-sm ${
            activeTab === 'competition'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('competition')}
        >
          积分赛统计
        </button>
      </div>

      {activeTab === 'performance' ? <PerformanceRanking /> : <CompetitionRanking />}
    </div>
  );
}
