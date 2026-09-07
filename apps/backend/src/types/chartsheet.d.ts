declare module "chartsheet" {
  export interface ChartSeries {
    name?: string;
    nameRef?: string;
    ref: string;
    xRef?: string;
    color?: string;
    colour?: string;
  }

  export interface ChartSpec {
    sheet: string;
    sheetPath?: string;
    type: "bar" | "column" | "line" | "pie" | "doughnut" | "area" | "scatter" | "radar";
    title?: string;
    xTitle?: string;
    yTitle?: string;
    categories?: string;
    series: ChartSeries[];
    anchor?: {
      col?: number;
      row?: number;
      colOffset?: number;
      rowOffset?: number;
    };
    width?: number;
    height?: number;
    stacked?: boolean;
    dataLabels?: boolean;
    gridlines?: boolean;
    numberFormat?: string;
    name?: string;
  }

  export function addChart(
    workbook: Buffer | Uint8Array | ArrayBuffer,
    spec: ChartSpec
  ): Promise<Buffer>;

  export function addCharts(
    workbook: Buffer | Uint8Array | ArrayBuffer,
    specs: ChartSpec[]
  ): Promise<Buffer>;
}
