import { Bar } from "react-chartjs-2";
import type {
  Chart,
  ChartOptions,
  Plugin,
  ScriptableContext,
  TooltipItem
} from "chart.js";
import "./chartjs";

type Thresholds = {
  upper?: number | null;
  lower?: number | null;
};

type UtilityBarChartProps = {
  labels: string[];
  values: number[];
  unit: string;
  color: string;
  height?: number;
  thresholds?: Thresholds;
};

const thresholdPlugin: Plugin<"bar", Thresholds> = {
  id: "thresholdLines",
  afterDatasetsDraw: (chart: Chart<"bar">, _args: unknown, options: Thresholds) => {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;

    const drawLine = (value: number, color: string) => {
      const y = scales.y.getPixelForValue(value);
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      ctx.restore();
    };

    if (options?.upper !== null && options?.upper !== undefined) {
      drawLine(options.upper, "rgba(251, 191, 36, 0.9)");
    }
    if (options?.lower !== null && options?.lower !== undefined) {
      drawLine(options.lower, "rgba(34, 197, 94, 0.9)");
    }
  }
};

export const UtilityBarChart = ({
  labels,
  values,
  unit,
  color,
  height = 200,
  thresholds
}: UtilityBarChartProps) => {
  const data = {
    labels,
    datasets: [
      {
        label: unit,
        data: values,
        backgroundColor: (ctx: ScriptableContext<"bar">) => {
          const { chart } = ctx;
          const { ctx: canvas } = chart;
          const gradient = canvas.createLinearGradient(0, 0, 0, chart.height);
          gradient.addColorStop(0, `${color}cc`);
          gradient.addColorStop(1, `${color}22`);
          return gradient;
        },
        borderRadius: 6,
        maxBarThickness: 24
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<"bar">) =>
            `${Number(context.parsed.y).toFixed(2)} ${unit}`
        }
      },
      thresholdLines: thresholds
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "rgba(148, 163, 184, 0.8)", font: { size: 10 } }
      },
      y: {
        grid: { color: "rgba(51, 65, 85, 0.4)" },
        ticks: {
          color: "rgba(148, 163, 184, 0.8)",
          callback: (value: number) => `${value}`
        }
      }
    }
  };

  const typedOptions = options as unknown as ChartOptions<"bar">;

  return (
    <div style={{ height }}>
      <Bar data={data} options={typedOptions} plugins={[thresholdPlugin]} />
    </div>
  );
};
