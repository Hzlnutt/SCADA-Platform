import { Doughnut } from "react-chartjs-2";
import type { Chart, ChartOptions, Plugin, TooltipItem } from "chart.js";
import "./chartjs";

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

    ctx.save();
    ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 12px Segoe UI";
    ctx.fillText(options.label, (chartArea.left + chartArea.right) / 2, chartArea.top + chartArea.height / 2 - 8);
    ctx.font = "700 16px Segoe UI";
    ctx.fillText(options.value, (chartArea.left + chartArea.right) / 2, chartArea.top + chartArea.height / 2 + 10);
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
  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 6
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "68%",
    plugins: {
      legend: { display: false },
      tooltip: {
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
