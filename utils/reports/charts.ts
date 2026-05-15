import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { abbreviateCollege, abbreviateDepartment } from "./abbreviate";

export function schoolUtilizationPieOption(
  active: number,
  total: number,
): EChartsOption {
  const notUsing = Math.max(0, total - active);
  return {
    title: { text: "School Utilization", left: "center" },
    legend: { orient: "vertical", left: "left", textStyle: { fontSize: 14 } },
    color: ["#22c55e", "#d1d5db"],
    series: [
      {
        name: "Utilization",
        type: "pie",
        radius: ["40%", "70%"],
        center: ["50%", "55%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        label: { show: true, formatter: "{b}\n{d}%", fontSize: 14 },
        data: [
          { value: active, name: "Using" },
          { value: notUsing, name: "Not Using" },
        ],
      },
    ],
  };
}

export function collegeOverallUtilizationPieOption(
  active: number,
  total: number,
): EChartsOption {
  const notUsing = Math.max(0, total - active);
  return {
    title: { text: "Overall College Utilization", left: "center" },
    legend: { orient: "vertical", left: "left", textStyle: { fontSize: 14 } },
    color: ["#22c55e", "#d1d5db"],
    series: [
      {
        name: "Utilization",
        type: "pie",
        radius: ["40%", "70%"],
        center: ["50%", "55%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        label: { show: true, formatter: "{b}\n{d}%", fontSize: 14 },
        data: [
          { value: active, name: "Using" },
          { value: notUsing, name: "Not Using" },
        ],
      },
    ],
  };
}

export function totalUtilizationPieOption(
  active: number,
  total: number,
): EChartsOption {
  const notUsing = Math.max(0, total - active);
  return {
    title: { text: "Total Utilization", left: "center" },
    legend: { orient: "vertical", left: "left", textStyle: { fontSize: 14 } },
    color: ["#22c55e", "#d1d5db"],
    series: [
      {
        name: "Utilization",
        type: "pie",
        radius: "70%",
        center: ["50%", "55%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        label: { show: true, formatter: "{b}\n{d}%", fontSize: 14 },
        data: [
          { value: active, name: "Using" },
          { value: notUsing, name: "Not Using" },
        ],
      },
    ],
  };
}

const COLLEGE_PALETTE = [
  "#fb923c",
  "#3b82f6",
  "#a855f7",
  "#22c55e",
  "#06b6d4",
  "#0ea5e9",
];

export function collegeUtilizationBarOption(
  byCollege: Array<{ collegeName: string; rate: number }>,
): EChartsOption {
  const ordered = [...byCollege]
    .sort((a, b) => b.rate - a.rate)
    .reverse();
  const items = ordered.map((c) => ({
    name: abbreviateCollege(c.collegeName),
    value: Number(c.rate) || 0,
  }));

  return {
    title: { text: "Utilization by College", left: "center" },
    grid: { left: 80, right: 80, top: 50, bottom: 40 },
    xAxis: {
      type: "value",
      max: 100,
      axisLabel: { formatter: "{value}%", fontSize: 14 },
    },
    yAxis: {
      type: "category",
      data: items.map((c) => c.name),
      axisLabel: { fontSize: 14 },
    },
    series: [
      {
        type: "bar",
        data: items.map((c, i) => ({
          value: c.value,
          itemStyle: {
            color: COLLEGE_PALETTE[i % COLLEGE_PALETTE.length],
          },
        })),
        label: {
          show: true,
          position: "right",
          formatter: "{c}%",
          fontWeight: "bold",
          fontSize: 14,
        },
        barWidth: "60%",
      },
    ],
  };
}

export function departmentUtilizationBarOption(
  byDepartment: Array<{ departmentName: string; rate: number }>,
  collegeName: string,
): EChartsOption {
  const ordered = [...byDepartment].sort((a, b) => b.rate - a.rate).reverse();
  const items = ordered.map((d) => ({
    name: abbreviateDepartment(d.departmentName),
    value: Number(d.rate) || 0,
  }));

  return {
    title: {
      text: `Utilization by Department — ${collegeName}`,
      left: "center",
    },
    grid: { left: 120, right: 80, top: 50, bottom: 40 },
    xAxis: {
      type: "value",
      max: 100,
      axisLabel: { formatter: "{value}%", fontSize: 14 },
    },
    yAxis: {
      type: "category",
      data: items.map((d) => d.name),
      axisLabel: { fontSize: 14 },
    },
    series: [
      {
        type: "bar",
        data: items.map((d, i) => ({
          value: d.value,
          itemStyle: {
            color: COLLEGE_PALETTE[i % COLLEGE_PALETTE.length],
          },
        })),
        label: {
          show: true,
          position: "right",
          formatter: "{c}%",
          fontWeight: "bold",
          fontSize: 14,
        },
        barWidth: "60%",
      },
    ],
  };
}

const ITEM_TYPE_COLORS: Record<string, string> = {
  multiple_choice: "#facc15",
  identification: "#9ca3af",
  enumeration: "#fb923c",
  essay: "#3b82f6",
  problem_solving: "#22c55e",
  code_on_paper: "#0ea5e9",
  visual: "#a855f7",
};

export function hoursSavedBarOption(
  items: Array<{ key: string; label: string; hours: number }>,
): EChartsOption {
  return {
    title: { text: "Hours Saved by Item Type", left: "center" },
    grid: { left: 60, right: 40, top: 60, bottom: 80 },
    xAxis: {
      type: "category",
      data: items.map((i) => i.label),
      axisLabel: { rotate: -20, fontSize: 14 },
    },
    yAxis: { type: "value", axisLabel: { fontSize: 14 } },
    series: [
      {
        type: "bar",
        data: items.map((i) => ({
          value: i.hours,
          itemStyle: { color: ITEM_TYPE_COLORS[i.key] ?? "#3b82f6" },
        })),
        label: {
          show: true,
          position: "top",
          formatter: "{c}",
          fontWeight: "bold",
          fontSize: 14,
        },
        barWidth: "55%",
      },
    ],
  };
}

export async function renderChartToPng(
  option: EChartsOption,
  width = 800,
  height = 450,
): Promise<Blob> {
  const div = document.createElement("div");
  div.style.cssText = `width:${width}px;height:${height}px;position:absolute;left:-9999px;top:0`;
  document.body.appendChild(div);

  const chart = echarts.init(div, null, {
    renderer: "canvas",
    devicePixelRatio: 2,
  });
  chart.setOption({ ...option, animation: false });

  const dataUrl = chart.getDataURL({
    type: "png",
    pixelRatio: 2,
    backgroundColor: "#fff",
  });

  chart.dispose();
  div.remove();

  const res = await fetch(dataUrl);
  return res.blob();
}
