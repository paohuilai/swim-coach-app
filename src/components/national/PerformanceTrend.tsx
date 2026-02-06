import React from 'react';
import ReactECharts from 'echarts-for-react';

export default function PerformanceTrend() {
  const option = {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['100m自由泳', '训练负荷'],
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['1月', '2月', '3月', '4月', '5月', '6月']
    },
    yAxis: [
        {
            type: 'value',
            name: '成绩(s)',
            min: 46,
            max: 50,
            inverse: true // Lower time is better
        },
        {
            type: 'value',
            name: '负荷(TRIMP)',
            min: 0,
            max: 200,
            splitLine: { show: false }
        }
    ],
    series: [
      {
        name: '100m自由泳',
        type: 'line',
        data: [48.5, 48.2, 47.9, 48.1, 47.5, 47.2],
        smooth: true,
        lineStyle: { width: 3, color: '#003399' },
        itemStyle: { color: '#003399' },
        markPoint: {
            data: [{ type: 'min', name: 'PB' }]
        }
      },
      {
        name: '训练负荷',
        type: 'bar',
        yAxisIndex: 1,
        data: [120, 135, 150, 110, 160, 180],
        itemStyle: { color: 'rgba(255, 204, 0, 0.5)' },
        barWidth: '40%'
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '300px' }} />;
}
