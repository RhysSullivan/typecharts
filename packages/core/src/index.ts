export type LineChartType = "line";
export type BarChartType = "bar";
export type AreaChartType = "area";
export type CumulativeLineChartType = "cumulative-line";
export type NumberChartType = "number";
export type PieChartType = "pie";
export type BarTotalChartType = "bar-total";
export type TableChartType = "table";
export type WorldChartType = "world";

export type ChartType =
  | LineChartType
  | BarChartType
  | AreaChartType
  | CumulativeLineChartType
  | NumberChartType
  | PieChartType
  | BarTotalChartType
  | TableChartType
  | WorldChartType;

export type TimeSeriesChartTypes =
  | LineChartType
  | BarChartType
  | AreaChartType
  | CumulativeLineChartType;

export const defaultChartDataKeys = {
  line: "date",
  bar: "date",
  area: "date",
  "cumulative-line": "date",
  number: "value",
  pie: "value",
  "bar-total": "value",
  table: "value",
  world: "value",
} as const;

export type DefaultDataKeyForChartType = typeof defaultChartDataKeys;

export type TimeSeriesChart<
  Entries extends string,
  Key extends string = DefaultDataKeyForChartType[ChartType],
> = {
  dataKey?: Key;
  data: Record<Entries | Key, string>[];
};

export type NumberChart<
  DataKey extends string = DefaultDataKeyForChartType[ChartType],
> = {
  dataKey?: DataKey;
  data: number;
};

export type PieChart<
  T extends string,
  DataKey extends string = DefaultDataKeyForChartType[ChartType],
> = {
  dataKey?: DataKey;
  data: {
    label: T;
    value: number;
  }[];
};

type ChartInternal<
  Type extends ChartType,
  Labels extends string,
  DataKey extends string = DefaultDataKeyForChartType[ChartType],
> = Type extends TimeSeriesChartTypes
  ? TimeSeriesChart<Labels, DataKey>
  : Type extends "number"
    ? NumberChart<DataKey>
    : Type extends "pie"
      ? PieChart<Labels, DataKey>
      : never;

export type Chart<
  Type extends ChartType,
  Labels extends string,
  DataKey extends string = DefaultDataKeyForChartType[ChartType],
> = ChartInternal<Type, Labels, DataKey> & { type: Type };
