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

type ThresholdsWithOptions = Thresholds & {
  unit?: string;
};

type UtilityBarChartProps = {
  labels: string[];
  values: number[];
  unit: string;
  color: string;
  height?: number;
  thresholds?: Thresholds;
};

const thresholdPlugin: Plugin<"bar", ThresholdsWithOptions> = {
  id: "thresholdLines",
  afterDatasetsDraw: (chart: Chart<"bar">, _args: unknown, options: ThresholdsWithOptions) => {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;

    const drawLine = (value: number, color: string, label: string) => {
      const y = scales.y.getPixelForValue(value);
      ctx.save();
      
      // Draw dashed line
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();

      // Draw label box on the left, overlapping the dashed line
      ctx.font = "bold 9px 'IBM Plex Sans', sans-serif";
      const textWidth = ctx.measureText(label).width;
      const boxWidth = textWidth + 8;
      const boxHeight = 14;
      const boxX = chartArea.left + 8;
      const boxY = y - boxHeight / 2;

      ctx.fillStyle = color;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 3);
      } else {
        ctx.rect(boxX, boxY, boxWidth, boxHeight);
      }
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(label, boxX + 4, y);
      ctx.restore();
    };

    if (options?.upper !== null && options?.upper !== undefined) {
      drawLine(options.upper, "rgba(239, 68, 68, 0.9)", `Maks: ${options.upper}${options.unit ? ` ${options.unit}` : ""}`);
    }
    if (options?.lower !== null && options?.lower !== undefined) {
      drawLine(options.lower, "rgba(59, 130, 246, 0.9)", `Min: ${options.lower}${options.unit ? ` ${options.unit}` : ""}`);
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
          const gradient = canvas.createLinearGradient(0, 0, 0, chart.height || 200);
          gradient.addColorStop(0, `${color}cc`);
          gradient.addColorStop(1, `${color}22`);
          return gradient;
        },
        borderWidth: 0,
        borderRadius: 4,
        barPercentage: 0.65
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
      thresholdLines: { ...thresholds, unit }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "rgba(148, 163, 184, 0.8)",
          font: { size: 10 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12
        }
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
