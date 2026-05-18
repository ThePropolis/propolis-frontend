'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { BarChart, PieChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, PieChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

interface EChartProps {
  option: EChartsCoreOption;
  style?: React.CSSProperties;
  className?: string;
}

export function EChart({ option, style, className }: EChartProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!divRef.current) return;
    chartRef.current = echarts.init(divRef.current);
    const observer = new ResizeObserver(() => chartRef.current?.resize());
    observer.observe(divRef.current);
    return () => { observer.disconnect(); chartRef.current?.dispose(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={divRef} style={style} className={className} />;
}
