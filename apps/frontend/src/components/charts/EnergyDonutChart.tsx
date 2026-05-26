import { Doughnut } from "react-chartjs-2";
import "./chartjs";

type EnergyDonutChartProps = {
  labels: string[];
  values: number[];
  colors: string[];
  centerLabel: string;
  centerValue: string;
  height?: number;
};

const centerTextPlugin = {
  id: "centerText",
  afterDraw: (chart: any, _args: unknown, options: { label: string; value: string }) => {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    ctx.save();
    ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 12px Space Grotesk";
    ctx.fillText(options.label, (chartArea.left + chartArea.right) / 2, chartArea.top + chartArea.height / 2 - 8);
    ctx.font = "700 16px Space Grotesk";
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
          label: (context: any) => `${context.label}: ${context.parsed.toFixed(1)}`
        }
      },
      centerText: { label: centerLabel, value: centerValue }
    }
  };

  return (
    <div style={{ height }}>
      <Doughnut data={data} options={options as any} plugins={[centerTextPlugin]} />
    </div>
  );
};
