import { Bar } from "react-chartjs-2";
import "./chartjs";

type EnergyTrendStackedChartProps = {
  labels: string[];
  electricity: number[];
  gas: number[];
  water: number[];
  height?: number;
};

export const EnergyTrendStackedChart = ({
  labels,
  electricity,
  gas,
  water,
  height = 260
}: EnergyTrendStackedChartProps) => {
  const data = {
    labels,
    datasets: [
      {
        label: "Listrik",
        data: electricity,
        backgroundColor: "rgba(56, 189, 248, 0.85)",
        borderRadius: 4
      },
      {
        label: "Gas",
        data: gas,
        backgroundColor: "rgba(250, 204, 21, 0.8)",
        borderRadius: 4
      },
      {
        label: "Air",
        data: water,
        backgroundColor: "rgba(74, 222, 128, 0.8)",
        borderRadius: 4
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: { color: "rgba(226, 232, 240, 0.9)", boxWidth: 10 }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.parsed.y.toFixed(1)}`
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: "rgba(148, 163, 184, 0.8)", font: { size: 10 } }
      },
      y: {
        stacked: true,
        grid: { color: "rgba(51, 65, 85, 0.4)" },
        ticks: { color: "rgba(148, 163, 184, 0.8)" }
      }
    }
  };

  return (
    <div style={{ height }}>
      <Bar data={data} options={options as any} />
    </div>
  );
};
