import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { format, differenceInDays, parseISO, addDays } from 'date-fns';

interface Task {
  id: string;
  name: string;
  start: string;
  end: string;
  owner: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
}

interface GanttChartProps {
  tasks: Task[];
}

export default function GanttChart({ tasks }: GanttChartProps) {
  const option = useMemo(() => {
    const data: any[] = [];
    const categories: string[] = Array.from(new Set(tasks.map(t => t.owner)));
    const startTime = parseISO("2024-01-01").getTime(); // Base time for calculation

    tasks.forEach(task => {
      const ownerIndex = categories.indexOf(task.owner);
      const start = parseISO(task.start).getTime();
      const end = parseISO(task.end).getTime();
      
      let color = '#3B82F6'; // blue
      if (task.status === 'completed') color = '#10B981'; // green
      if (task.status === 'overdue') color = '#EF4444'; // red
      if (task.status === 'in_progress') color = '#F59E0B'; // yellow

      data.push({
        name: task.name,
        value: [
          ownerIndex,
          start,
          end,
          end - start // duration
        ],
        itemStyle: {
          color: color
        }
      });
    });

    return {
      tooltip: {
        formatter: function (params: any) {
          return params.marker + params.name + ': ' + format(new Date(params.value[1]), 'yyyy-MM-dd') + ' ~ ' + format(new Date(params.value[2]), 'yyyy-MM-dd');
        }
      },
      title: {
        text: '任务协同进度',
        left: 'center'
      },
      dataZoom: [
        {
          type: 'slider',
          filterMode: 'weakFilter',
          showDataShadow: false,
          top: 400,
          labelFormatter: ''
        },
        {
          type: 'inside',
          filterMode: 'weakFilter'
        }
      ],
      grid: {
        height: 300
      },
      xAxis: {
        type: 'time',
        min: startTime,
        axisLabel: {
            formatter: (val: number) => format(new Date(val), 'MM-dd')
        }
      },
      yAxis: {
        data: categories
      },
      series: [
        {
          type: 'custom',
          renderItem: function (params: any, api: any) {
            var categoryIndex = api.value(0);
            var start = api.coord([api.value(1), categoryIndex]);
            var end = api.coord([api.value(2), categoryIndex]);
            var height = api.size([0, 1])[1] * 0.6;
            
            var rectShape = echarts.graphic.clipRectByRect(
              {
                x: start[0],
                y: start[1] - height / 2,
                width: end[0] - start[0],
                height: height
              },
              {
                x: params.coordSys.x,
                y: params.coordSys.y,
                width: params.coordSys.width,
                height: params.coordSys.height
              }
            );
            return (
              rectShape && {
                type: 'rect',
                transition: ['shape'],
                shape: rectShape,
                style: api.style()
              }
            );
          },
          itemStyle: {
            opacity: 0.8
          },
          encode: {
            x: [1, 2],
            y: 0
          },
          data: data
        }
      ]
    };
  }, [tasks]);

  return <ReactECharts option={option} style={{ height: '450px', width: '100%' }} />;
}
