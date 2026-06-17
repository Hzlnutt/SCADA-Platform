import { Bar } from "react-chartjs-2";
import type {
  Chart,
  ChartOptions,
  Plugin,
  ScriptableContext,
  TooltipItem
} from "chart.js";
import "./chartjs";
import { useSystemStore } from "../../store/system.store";

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
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  const data = {
    labels,
    datasets: [
      {
        label: unit,
        data: values,
        backgroundColor: (ctx: ScriptableContext<"bar">) => {
          const { chart } = ctx;
          const { ctx: canvas, chartArea } = chart;
          if (!chartArea) return `${color}aa`;
          const gradient = canvas.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, `${color}ee`);
          gradient.addColorStop(1, `${color}11`);
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
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? "rgba(13, 21, 39, 0.95)" : "rgba(255, 255, 255, 0.95)",
        titleColor: isDark ? "rgba(241, 245, 249, 0.9)" : "rgba(15, 23, 42, 0.9)",
        bodyColor: isDark ? "rgba(241, 245, 249, 0.9)" : "rgba(15, 23, 42, 0.9)",
        borderColor: isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(203, 213, 225, 0.5)",
        borderWidth: 1,
        padding: 8,
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
          color: isDark ? "rgba(148, 163, 184, 0.8)" : "rgba(71, 85, 105, 0.8)",
          font: { size: 10 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12
        }
      },
      y: {
        grid: { color: isDark ? "rgba(51, 65, 85, 0.4)" : "rgba(203, 213, 225, 0.6)" },
        ticks: {
          color: isDark ? "rgba(148, 163, 184, 0.8)" : "rgba(71, 85, 105, 0.8)",
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
