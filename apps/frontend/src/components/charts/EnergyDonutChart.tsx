import { Doughnut } from "react-chartjs-2";
import type { Chart, ChartOptions, Plugin, TooltipItem } from "chart.js";
import "./chartjs";
import { useSystemStore } from "../../store/system.store";

type EnergyDonutChartProps = {
  labels: string[];
  values: number[];
  colors: string[];
  centerLabel: string;
  centerValue: string;
  height?: number;
};

const centerTextPlugin: Plugin<"doughnut", { label: string; value: string }> = {
  id: "centerText",
  afterDraw: (
    chart: Chart<"doughnut">,
    _args: unknown,
    options: { label: string; value: string }
  ) => {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    const isDark = document.documentElement.classList.contains("dark");

    ctx.save();
    // Center Label (e.g. "Total")
    ctx.fillStyle = isDark ? "rgba(148, 163, 184, 0.85)" : "rgba(71, 114, 159, 0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 11px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(options.label, (chartArea.left + chartArea.right) / 2, chartArea.top + chartArea.height / 2 - 9);

    // Center Value
    ctx.fillStyle = isDark ? "rgba(241, 245, 249, 0.95)" : "rgba(0, 43, 92, 0.95)";
    ctx.font = "bold 16px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(options.value, (chartArea.left + chartArea.right) / 2, chartArea.top + chartArea.height / 2 + 9);
    ctx.restore();
  }
};

export const EnergyDonutChart = ({
  labels,
  values,
  colors,
  centerLabel,
  centerValue,
  height = 220
}: EnergyDonutChartProps) => {
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: isDark ? "#0d1527" : "#ffffff",
        hoverBorderColor: isDark ? "#0d1527" : "#ffffff",
        hoverBorderWidth: 4,
        borderRadius: 4,
        hoverOffset: 6
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "68%",
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 1000,
      easing: "easeOutQuart" as const
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? "rgba(13, 21, 39, 0.95)" : "rgba(255, 255, 255, 0.95)",
        titleColor: isDark ? "rgba(241, 245, 249, 0.9)" : "rgba(15, 23, 42, 0.9)",
        bodyColor: isDark ? "rgba(241, 245, 249, 0.9)" : "rgba(15, 23, 42, 0.9)",
        borderColor: isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(203, 213, 225, 0.5)",
        borderWidth: 1,
        padding: 8,
        callbacks: {
          label: (context: TooltipItem<"doughnut">) =>
            `${context.label}: ${Number(context.parsed).toFixed(1)}`
        }
      },
      centerText: { label: centerLabel, value: centerValue }
    }
  };

  const typedOptions = options as unknown as ChartOptions<"doughnut">;

  return (
    <div style={{ height }}>
      <Doughnut data={data} options={typedOptions} plugins={[centerTextPlugin]} />
    </div>
  );
};
