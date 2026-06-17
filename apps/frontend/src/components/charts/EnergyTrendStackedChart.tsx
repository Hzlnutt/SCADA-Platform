import { Line } from "react-chartjs-2";
import type { ChartOptions, TooltipItem, ScriptableContext } from "chart.js";
import "./chartjs";
import { useSystemStore } from "../../store/system.store";

type EnergyTrendStackedChartProps = {
  labels: string[];
  electricity: number[];
  gas: number[];
  water: number[];
  solar?: number[];
  height?: number;
};

export const EnergyTrendStackedChart = ({
  labels,
  electricity,
  gas,
  water,
  solar,
  height = 260
}: EnergyTrendStackedChartProps) => {
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  const data = {
    labels,
    datasets: [
      {
        label: "Listrik",
        data: electricity,
        borderColor: isDark ? "rgba(56, 189, 248, 1)" : "rgba(31, 111, 181, 1)",
        backgroundColor: (ctx: ScriptableContext<"line">) => {
          const { chart } = ctx;
          const { ctx: canvas, chartArea } = chart;
          if (!chartArea) return "rgba(56, 189, 248, 0.05)";
          const gradient = canvas.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          const color = isDark ? "56, 189, 248" : "31, 111, 181";
          gradient.addColorStop(0, `rgba(${color}, 0.35)`);
          gradient.addColorStop(1, `rgba(${color}, 0.0)`);
          return gradient;
        },
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5
      },
      {
        label: "Gas",
        data: gas,
        borderColor: isDark ? "rgba(250, 204, 21, 1)" : "rgba(217, 119, 6, 1)",
        backgroundColor: (ctx: ScriptableContext<"line">) => {
          const { chart } = ctx;
          const { ctx: canvas, chartArea } = chart;
          if (!chartArea) return "rgba(250, 204, 21, 0.05)";
          const gradient = canvas.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          const color = isDark ? "250, 204, 21" : "217, 119, 6";
          gradient.addColorStop(0, `rgba(${color}, 0.35)`);
          gradient.addColorStop(1, `rgba(${color}, 0.0)`);
          return gradient;
        },
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5
      },
      {
        label: "Air",
        data: water,
        borderColor: isDark ? "rgba(74, 222, 128, 1)" : "rgba(22, 163, 74, 1)",
        backgroundColor: (ctx: ScriptableContext<"line">) => {
          const { chart } = ctx;
          const { ctx: canvas, chartArea } = chart;
          if (!chartArea) return "rgba(74, 222, 128, 0.05)";
          const gradient = canvas.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          const color = isDark ? "74, 222, 128" : "22, 163, 74";
          gradient.addColorStop(0, `rgba(${color}, 0.35)`);
          gradient.addColorStop(1, `rgba(${color}, 0.0)`);
          return gradient;
        },
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5
      },
      ...(solar ? [
        {
          label: "Solar Panel",
          data: solar,
          borderColor: isDark ? "rgba(245, 158, 11, 1)" : "rgba(217, 70, 23, 1)",
          backgroundColor: (ctx: ScriptableContext<"line">) => {
            const { chart } = ctx;
            const { ctx: canvas, chartArea } = chart;
            if (!chartArea) return "rgba(245, 158, 11, 0.05)";
            const gradient = canvas.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            const color = isDark ? "245, 158, 11" : "217, 70, 23";
            gradient.addColorStop(0, `rgba(${color}, 0.35)`);
            gradient.addColorStop(1, `rgba(${color}, 0.0)`);
            return gradient;
          },
          borderWidth: 2.5,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 5
        }
      ] : [])
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1000,
      easing: "easeOutQuart" as const
    },
    hover: {
      mode: "index" as const,
      intersect: false
    },
    transitions: {
      active: {
        animation: {
          duration: 250
        }
      }
    },
    plugins: {
      legend: {
        position: "top" as const,
        labels: { color: isDark ? "rgba(226, 232, 240, 0.9)" : "rgba(15, 23, 42, 0.85)", boxWidth: 10 }
      },
      tooltip: {
        backgroundColor: isDark ? "rgba(13, 21, 39, 0.95)" : "rgba(255, 255, 255, 0.95)",
        titleColor: isDark ? "rgba(241, 245, 249, 0.9)" : "rgba(15, 23, 42, 0.9)",
        bodyColor: isDark ? "rgba(241, 245, 249, 0.9)" : "rgba(15, 23, 42, 0.9)",
        borderColor: isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(203, 213, 225, 0.5)",
        borderWidth: 1,
        padding: 8,
        callbacks: {
          label: (context: TooltipItem<"line">) =>
            `${context.dataset.label}: ${Number(context.parsed.y).toFixed(1)}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? "rgba(148, 163, 184, 0.8)" : "rgba(71, 85, 105, 0.8)", font: { size: 10 } }
      },
      y: {
        grid: { color: isDark ? "rgba(51, 65, 85, 0.4)" : "rgba(226, 232, 240, 0.8)" },
        ticks: { color: isDark ? "rgba(148, 163, 184, 0.8)" : "rgba(71, 85, 105, 0.8)" }
      }
    }
  };

  const typedOptions = options as unknown as ChartOptions<"line">;

  return (
    <div style={{ height }}>
      <Line data={data} options={typedOptions} />
    </div>
  );
};
