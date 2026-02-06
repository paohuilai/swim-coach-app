import { useState, useRef } from 'react';
import ReactPlayer from 'react-player';
import { Play, Pause, RotateCcw, PenTool, SplitSquareHorizontal } from 'lucide-react';

const Player = ReactPlayer as any;

export default function WarRoom() {
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  
  const player1Ref = useRef<any>(null);
  const player2Ref = useRef<any>(null);

  const handlePlayPause = () => {
    setPlaying(!playing);
  };

  const handleSeek = (seconds: number) => {
    player1Ref.current?.seekTo(seconds);
    player2Ref.current?.seekTo(seconds);
  };

  const handleRewind = () => {
      const current = player1Ref.current?.getCurrentTime() || 0;
      handleSeek(Math.max(0, current - 5));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-brand-dark">赛事数据作战室</h1>
            <p className="text-sm text-gray-500">Competition War Room & Video Analysis</p>
        </div>
        <div className="flex gap-2">
            <button className="bg-white border border-gray-300 px-3 py-1.5 rounded text-sm flex items-center gap-2">
                <SplitSquareHorizontal className="w-4 h-4" />
                对比模式
            </button>
            <button className="bg-brand-gold text-brand-blue font-bold px-4 py-1.5 rounded flex items-center gap-2 shadow-sm">
                <PenTool className="w-4 h-4" />
                标注工具
            </button>
        </div>
      </div>

      {/* Video Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black p-4 rounded-xl shadow-2xl">
          <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-800 group">
              <span className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded z-10">本队选手: 潘展乐 (Lane 4)</span>
              <Player 
                ref={player1Ref}
                url="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" 
                width="100%" 
                height="100%" 
                playing={playing}
                playbackRate={playbackRate}
                controls={false}
              />
          </div>
          <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
              <span className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded z-10">对手: 波波维奇 (Lane 5)</span>
              <Player 
                ref={player2Ref}
                url="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4" 
                width="100%" 
                height="100%" 
                playing={playing}
                playbackRate={playbackRate}
                controls={false}
              />
          </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-center items-center gap-6">
          <button onClick={handleRewind} className="p-3 rounded-full hover:bg-gray-100 text-gray-600">
              <RotateCcw className="w-6 h-6" />
          </button>
          
          <button onClick={handlePlayPause} className="p-4 rounded-full bg-brand-blue text-white hover:bg-blue-800 shadow-lg transition-transform hover:scale-105">
              {playing ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
          </button>

          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              {[0.5, 1.0, 1.5, 2.0].map(rate => (
                  <button 
                    key={rate}
                    onClick={() => setPlaybackRate(rate)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${playbackRate === rate ? 'bg-white shadow text-brand-blue' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                      {rate}x
                  </button>
              ))}
          </div>
      </div>

      {/* Analysis Data */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3">分段成绩对比</h3>
              <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500">0-50m</span>
                      <div className="flex gap-4">
                          <span className="text-blue-600 font-bold">22.5s</span>
                          <span className="text-red-600 font-bold">22.7s</span>
                      </div>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500">50-100m</span>
                      <div className="flex gap-4">
                          <span className="text-blue-600 font-bold">24.3s</span>
                          <span className="text-red-600 font-bold">24.1s</span>
                      </div>
                  </div>
                  <div className="flex justify-between pt-1">
                      <span className="text-gray-800 font-bold">Total</span>
                      <div className="flex gap-4">
                          <span className="text-blue-600 font-bold">46.8s</span>
                          <span className="text-red-600 font-bold">46.8s</span>
                      </div>
                  </div>
              </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm md:col-span-2">
              <h3 className="font-bold text-gray-800 mb-3">AI 技术分析建议</h3>
              <ul className="space-y-3">
                  <li className="flex gap-3 text-sm">
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded h-fit whitespace-nowrap">转身</span>
                      <span className="text-gray-600">在 50m 转身处，你的蹬壁时间比对手慢 0.2s，建议加强核心爆发力训练。</span>
                  </li>
                  <li className="flex gap-3 text-sm">
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded h-fit whitespace-nowrap">划频</span>
                      <span className="text-gray-600">后程 25m 划频下降明显 (52 -&gt; 46)，需注意保持高肘位置。</span>
                  </li>
              </ul>
          </div>
      </div>
    </div>
  );
}
