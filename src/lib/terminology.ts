
// 游泳专业术语库
export const SWIMMING_TERMINOLOGY = {
  technical: {
    stroke_rate: { label: "划频", description: "每分钟划水次数 (spm)" },
    stroke_length: { label: "划幅", description: "单次划水前进的距离 (m)" },
    stroke_count: { label: "划次", description: "游进单位距离（如50米）的划水次数" },
    turn_time: { label: "转身时间", description: "从手触壁到脚蹬离壁的时间 (s)" },
  },
  training: {
    rpe: { label: "RPE", description: "主观疲劳度 (1-10)" },
    tss: { label: "TSS", description: "训练压力评分" },
    split_time: { label: "分段成绩", description: "比赛或训练中每段距离的用时" },
    pb: { label: "PB", description: "个人最好成绩 (Personal Best)" },
  }
};

/**
 * 格式化游泳成绩时间 (支持智能输入)
 * 输入: "50.5", "1:50", "10235" (1:02.35), "2635" (26.35)
 * 输出: "00:50.50", "01:50.00", "01:02.35", "00:26.35"
 */
export function formatSwimTime(input: string | number): string {
  if (!input) return "";
  
  let str = input.toString().trim();
  
  // 1. 处理纯数字无标点 (Smart Typing)
  // 2635 -> 26.35s; 10235 -> 1m02.35s
  if (/^\d+$/.test(str)) {
    // Exception: simple seconds like "50" -> "50.00" if user intended seconds?
    // But "2635" usually means 26s 35ms. 
    // Logic: If length >= 3, treat last 2 as ms.
    if (str.length >= 3) {
      const centi = parseInt(str.slice(-2));
      const rest = str.slice(0, -2);
      let sec = 0;
      let min = 0;
      
      if (rest.length <= 2) {
        sec = parseInt(rest);
      } else {
        sec = parseInt(rest.slice(-2));
        min = parseInt(rest.slice(0, -2));
      }
      
      // Normalize
      min += Math.floor(sec / 60);
      sec = sec % 60;
      
      return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${centi.toString().padStart(2, '0')}`;
    }
  }

  // 2. 处理带小数点的数字 (秒)
  if (/^\d+(\.\d+)?$/.test(str)) {
    const seconds = parseFloat(str);
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.round((seconds - Math.floor(seconds)) * 100);
    
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  
  // 3. 处理 "1分50秒" 格式
  if (str.includes('分') || str.includes('秒')) {
    str = str.replace('分', ':').replace('秒', '.');
  }

  // 标准化分隔符
  str = str.replace('：', ':').replace('。', '.');
  
  const parts = str.split(':');
  
  if (parts.length === 1) {
    // 只有秒，如 "50.50"
    const secParts = parts[0].split('.');
    const secs = secParts[0].padStart(2, '0');
    const ms = (secParts[1] || '00').padEnd(2, '0').slice(0, 2);
    return `00:${secs}.${ms}`;
  } else if (parts.length === 2) {
    // 分:秒
    const mins = parts[0].padStart(2, '0');
    const secParts = parts[1].split('.');
    const secs = secParts[0].padStart(2, '0');
    const ms = (secParts[1] || '00').padEnd(2, '0').slice(0, 2);
    return `${mins}:${secs}.${ms}`;
  }
  
  return str; // 无法解析则返回原值
}

/**
 * 解析时间字符串为秒数
 */
export function parseSwimTime(timeStr: string): number {
  if (!timeStr) return 0;
  
  // 标准化
  const formatted = formatSwimTime(timeStr);
  const parts = formatted.split(':');
  
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseFloat(parts[1]);
    return mins * 60 + secs;
  }
  
  return parseFloat(timeStr) || 0;
}
