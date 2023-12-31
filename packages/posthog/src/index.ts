import {
  ChartType,
  Chart,
  TimeSeriesChart,
  DefaultDataKeyForChartType,
  PieChart,
  defaultChartDataKeys,
} from "@typecharts/core";

const mathTypes = [
  "total",
  "dau",
  "weekly_active",
  "monthly_active",
  "unique_group",
  "unique_session",
  "sum",
  "min",
  "max",
  // "avg", TODO: Re-enable in the future
  "median",
  "p90",
  "p95",
  "p99",
  "min_count_per_actor",
  "max_count_per_actor",
  "avg_count_per_actor",
  "median_count_per_actor",
  "p90_count_per_actor",
  "p95_count_per_actor",
  "p99_count_per_actor",
  "hogql",
] as const;

export type PosthogPropertyType =
  | "DateTime"
  | "String"
  | "Numeric"
  | "Boolean"
  | null;
export type PostHogProperty = {
  name: string;
  type: PosthogPropertyType;
};

export type PostHogEvent = {
  name: string;
  properties: readonly PostHogProperty[];
};

type _ExtendOnlyEventMap = Record<string, PostHogEvent>;

export type PostHogSamplingOptions = (typeof mathTypes)[number];

export type PostHogFilter<
  EventName extends string,
  Events extends _ExtendOnlyEventMap,
> = {
  name: Events[EventName]["properties"][number]["name"];
  compare:
    | "equals"
    | "does_not_equal"
    | "contains"
    | "does_not_contain"
    | "matches_regex"
    | "does_not_match_regex"
    | "greater_than"
    | "less_than"
    | "is_set"
    | "is_not_set";
  value: string | number | boolean;
};

export type PostHogFilterGroup<
  T extends string,
  Events extends _ExtendOnlyEventMap,
> = {
  match: "all" | "any";
  filters: PostHogFilter<T, Events> | PostHogFilter<T, Events>[];
};

export type PostHogSeries<
  T extends string,
  Events extends _ExtendOnlyEventMap,
> = {
  name: T;
  label?: string;
  sampling: PostHogSamplingOptions;
  where?: PostHogFilterGroup<T, Events> | PostHogFilterGroup<T, Events>[];
};

type Interval = "day" | "hour" | "week" | "month";

type PostHogExecuteOptions<
  PropertyNames extends string,
  DataIndex extends string,
> = {
  groupBy: Interval;
  filterMatch?: "all" | "any";
  type: ChartType;
  breakdownBy?: PropertyNames;
  compareToPreviousPeriod?: boolean;
  dataIndex?: DataIndex;
};

type PostHogConfig = {
  apiKey: string;
  projectId: string;
  url: string;
};

type TrendResult = {
  count: number;
  data: number[];
  days: string[];
  dates?: string[];
  label: string;
  labels: string[];
  breakdown_value?: string | number;
  aggregated_value: number;
  status?: string;
  compare?: boolean;
  persons_urls?: { url: string }[];
};

export type TrendAPIResponse<ResultType = TrendResult[]> = {
  type: "Trends";
  is_cached: boolean;
  last_refresh: string | null;
  result: ResultType;
  timezone: string;
  next: string | null;
};

function trendsApiResponseToTimeseries<
  Labels extends string,
  DataKey extends string,
>(
  input: TrendAPIResponse,
  series: {
    name: string;
    label?: string;
  }[],
  dataKey: DataKey = "date" as DataKey
): TimeSeriesChart<Labels, DataKey> {
  const output: TimeSeriesChart<Labels, DataKey>["data"] = new Array(
    input.result.length
  ) as TimeSeriesChart<Labels, DataKey>["data"];
  input.result.forEach((result, resultIndex) => {
    result.data.forEach((value, i) => {
      const entry = output[i];
      const date = result.labels[i];
      const label = series[resultIndex]?.label ?? result.label;
      if (!date) {
        return;
      }
      if (!entry) {
        output[i] = {
          [dataKey]: date,
          [label as Labels]: value,
        } as TimeSeriesChart<Labels, DataKey>["data"][number];
      } else {
        entry[label as Labels] = value.toString();
      }
    });
  });
  return {
    data: output,
    dataKey,
  };
}

export function toParams(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: Record<string, any>,
  explodeArrays = false
): string {
  if (!obj) {
    return "";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleVal(val: any): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    val = typeof val === "object" ? JSON.stringify(val) : val;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return encodeURIComponent(val);
  }

  return Object.entries(obj)
    .filter((item) => item[1] != undefined && item[1] != null)
    .reduce(
      (acc, [key, val]) => {
        /**
         *  query parameter arrays can be handled in two ways
         *  either they are encoded as a single query parameter
         *    a=[1, 2] => a=%5B1%2C2%5D
         *  or they are "exploded" so each item in the array is sent separately
         *    a=[1, 2] => a=1&a=2
         **/
        if (explodeArrays && Array.isArray(val)) {
          val.forEach((v) => acc.push([key, v]));
        } else {
          acc.push([key, val]);
        }

        return acc;
      },
      [] as [string, unknown][]
    )
    .map(([key, val]) => `${key}=${handleVal(val)}`)
    .join("&");
}

type PostHogDisplayType =
  | "BoldNumber"
  | "ActionsLineGraph"
  | "ActionsTable"
  | "ActionsPie"
  | "ActionsBar"
  | "ActionsBarValue"
  | "ActionsLineGraphCumulative"
  | "ActionsAreaGraph"
  | "WorldMap";

type PostHogInsightTrendParams = {
  insight: "TRENDS";
  properties?: {
    type: "AND" | "OR";
    values: {
      key: string;
      value: (string | number | boolean) | (string | number | boolean)[];
      operator: "exact";
      type: "event";
    }[];
  };
  date_from: string;
  entity_type: "events";
  filter_test_accounts: boolean;
  refresh: boolean;
  events: {
    type: "events";
    id: string;
    order: number;
    name: string;
    math: PostHogSamplingOptions;
  }[];
  formula?: string;
  interval: Interval;
  display: PostHogDisplayType;
};

const chartTypeToPostHogType: Record<ChartType, PostHogDisplayType> = {
  "bar-total": "ActionsBarValue",
  "cumulative-line": "ActionsLineGraphCumulative",
  line: "ActionsLineGraph",
  bar: "ActionsBar",
  area: "ActionsAreaGraph",
  number: "BoldNumber",
  pie: "ActionsPie",
  table: "ActionsTable",
  world: "WorldMap",
};

type AllLabelsOrNames<
  EventName extends string,
  Events extends _ExtendOnlyEventMap,
  Series extends PostHogSeries<EventName, Events> = PostHogSeries<
    EventName,
    Events
  >,
> = {
  [K in keyof Series as "label"]: Series["label"] extends string
    ? Series["label"]
    : Series["name"];
}["label"];

class PostHogQuery<
  const Events extends _ExtendOnlyEventMap,
  const EventNames extends Extract<keyof Events, string>,
  const Filters extends PostHogFilterGroup<EventNames, Events>,
  const Series extends PostHogSeries<EventNames, Events>,
> {
  constructor(
    // can't make inferred types work without passing in events
    private readonly events: Events,
    private readonly series: Series[],
    private readonly filterGroups: Filters[],
    private readonly config: PostHogConfig
  ) {}

  addSeries<
    const NewEventName extends EventNames,
    const NewSeries extends Omit<PostHogSeries<NewEventName, Events>, "name">,
  >(
    name: NewEventName,
    event: NewSeries
  ): PostHogQuery<
    Events,
    EventNames | NewEventName,
    Filters,
    Series | (NewSeries & { name: NewEventName })
  > {
    return new PostHogQuery(
      this.events,
      [
        ...this.series,
        {
          ...event,
          name,
        },
      ],
      this.filterGroups,
      this.config
    );
  }

  addFilterGroup<NewFilter extends PostHogFilterGroup<Series["name"], Events>>(
    filter: NewFilter
  ): PostHogQuery<Events, EventNames, Filters | NewFilter, Series> {
    return new PostHogQuery<Events, EventNames, Filters | NewFilter, Series>(
      this.events,
      this.series,
      [...this.filterGroups, filter],
      this.config
    );
  }

  async execute<
    const DataKey extends string,
    ExecutionOptions extends PostHogExecuteOptions<
      Events[Series["name"]]["properties"][number]["name"],
      DataKey
    >,
    ChartType extends ExecutionOptions["type"],
    Labels extends AllLabelsOrNames<Series["name"], Events, Series>,
    A extends ExecutionOptions["dataIndex"] extends string
      ? ExecutionOptions["dataIndex"]
      : DefaultDataKeyForChartType[ExecutionOptions["type"]],
    Output extends Chart<ChartType, Labels, A> &
      Required<Pick<Chart<ChartType, Labels, A>, "dataKey">>,
  >(options: ExecutionOptions): Promise<Output> {
    const reqData: PostHogInsightTrendParams = {
      insight: "TRENDS",
      refresh: false,
      filter_test_accounts: false,
      entity_type: "events",
      events: this.series.map((scenario, index) => ({
        id: scenario.name,
        name: scenario.name,
        order: index,
        type: "events",
        math: scenario.sampling,
      })),
      properties: {
        type: "OR",
        values: [],
      },
      date_from: "-7d",
      display: chartTypeToPostHogType[options.type],
      interval: options.groupBy,
    };
    const encodedQueryString = toParams(reqData);
    const url = `https://app.posthog.com/api/projects/${this.config.projectId}/insights/trend/?${encodedQueryString}`;
    const fetchResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      method: "GET",
    });
    if (!fetchResponse.ok) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const text = await fetchResponse.json();
      throw new Error(
        `Failed to fetch data: ${fetchResponse.statusText} ${JSON.stringify(
          text
        )}`
      );
    }
    const json = (await fetchResponse.json()) as TrendAPIResponse;
    let output: Output;
    switch (options.type) {
      case "bar":
      case "area":
      case "cumulative-line":
      case "line": {
        output = trendsApiResponseToTimeseries(json, this.series) as Output;
        break;
      }
      case "pie": {
        const agg: PieChart<Labels, DataKey>["data"] = [];
        json.result.forEach((result, resultIndex) => {
          agg.push({
            label: this.series[resultIndex]?.label ?? result.label,
            value: result.aggregated_value,
          } as PieChart<Labels, DataKey>["data"][number]);
        });
        output = {
          data: agg,
          dataKey: options.dataIndex ?? defaultChartDataKeys[options.type],
        } as Output;
        break;
      }
      case "number": {
        const value = json.result[0]?.aggregated_value ?? 0;

        output = {
          dataKey:
            this.series[0]?.label ??
            json.result[0]?.label ??
            defaultChartDataKeys[options.type],
          data: value,
        } as Output;
        break;
      }
      default:
        throw new Error(`Unsupported type: ${options.type}`);
    }
    output["type"] = options.type as ChartType;
    return output;
  }
}

export class PostHog<const Events extends _ExtendOnlyEventMap> {
  private config: PostHogConfig;
  constructor(opts?: Partial<PostHogConfig>) {
    const apiKey = opts?.apiKey ?? process.env.POSTHOG_API_KEY;

    if (!apiKey) {
      throw new Error("PostHog ApiKey is required");
    }
    const projectId = opts?.projectId ?? process.env.POSTHOG_PROJECT_ID;

    if (!projectId) {
      throw new Error("PostHog ProjectId is required");
    }
    const url =
      opts?.url ??
      process.env.POSTHOG_URL ??
      `https://app.posthog.com/api/projects/${projectId}/`;
    this.config = {
      apiKey,
      projectId,
      url,
    };
  }

  query() {
    // ts has issues, we never use events so this is fine
    // if you're reading this, no you're not
    // unless you know how to solve it, then make a PR
    // this is our secret
    // don't snitch
    return new PostHogQuery({} as Events, [], [], this.config);
  }
}
