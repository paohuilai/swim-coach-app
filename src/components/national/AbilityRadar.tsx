import React from 'react';
import ReactECharts from 'echarts-for-react';

export default function AbilityRadar() {
  const option = {
    title: {
      text: ''
    },
    tooltip: {},
    radar: {
      indicator: [
        { name: '有氧耐力', max: 100 },
        { name: '无氧爆发', max: 100 },
        { name: '技术效能', max: 100 },
        { name: '心理素质', max: 100 },
        { name: '身体柔韧', max: 100 },
        { name: '恢复能力', max: 100 }
      ],
      radius: '65%',
      center: ['50%', '50%'],
    },
    series: [
      {
        name: '能力维度',
        type: 'radar',
        data: [
          {
            value: [85, 90, 75, 95, 80, 88],
            name: '当前状态',
            areaStyle: {
                color: 'rgba(0, 51, 153, 0.2)'
            },
            lineStyle: {
                color: '#003399'
            },
            itemStyle: {
                color: '#003399'
            }
          },
          {
            value: [80, 85, 80, 90, 85, 85],
            name: '上月对比',
            lineStyle: {
                type: 'dashed',
                color: '#FFCC00'
            },
            itemStyle: {
                color: '#FFCC00'
            }
          }
        ]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '300px' }} />;
}
