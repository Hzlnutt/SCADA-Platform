import { Line } from "react-chartjs-2";
import type { ChartOptions, TooltipItem } from "chart.js";
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
        borderColor: "rgba(56, 189, 248, 1)",
        backgroundColor: "rgba(56, 189, 248, 0.08)",
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5
      },
      {
        label: "Gas",
        data: gas,
        borderColor: "rgba(250, 204, 21, 1)",
        backgroundColor: "rgba(250, 204, 21, 0.08)",
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5
      },
      {
        label: "Air",
        data: water,
        borderColor: "rgba(74, 222, 128, 1)",
        backgroundColor: "rgba(74, 222, 128, 0.08)",
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5
      },
      ...(solar ? [
        {
          label: "Solar Panel",
          data: solar,
          borderColor: "rgba(245, 158, 11, 1)",
          backgroundColor: "rgba(245, 158, 11, 0.08)",
          borderWidth: 2,
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
    plugins: {
      legend: {
        position: "top" as const,
        labels: { color: isDark ? "rgba(226, 232, 240, 0.9)" : "rgba(15, 23, 42, 0.85)", boxWidth: 10 }
      },
      tooltip: {
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
