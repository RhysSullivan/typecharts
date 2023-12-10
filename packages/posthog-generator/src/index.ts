import {
  PostHogEvent,
  toParams,
  PosthogPropertyType,
} from "@typecharts/posthog";
import fs from "node:fs/promises";
import path from "node:path";

let posthogToken = process.env.POSTHOG_API_KEY;
let posthogProjectId = process.env.POSTHOG_PROJECT_ID;

export async function generateTypeScriptFile(events: PostHogEvent[]) {
  const eventMap = events.reduce(
    (acc, event) => {
      acc[event.name] = event;
      return acc;
    },
    {} as Record<string, PostHogEvent>
  );

  const typeScriptFileContent = `
    // This file is auto-generated by the posthog-generator
    // While it's not recommended, you are free to modify it however you may need
    // Along with that, this file should be safe to commit to your source control and will contain no secrets
    export const events = ${JSON.stringify(eventMap, null, 2)} as const;
    export type PostHogEvents = typeof events;
    `;

  // write file to dist/events.ts
  const filePath = path.join(process.cwd(), "events.ts");
  await fs.writeFile(filePath, typeScriptFileContent, "utf-8");
}

export type PosthogEventType = {
  id: string;
  name: string;
  owner: null | string;
  description: null | string;
  created_at: string;
  updated_at: null | string;
  updated_by: null | string;
  last_seen_at: string;
  verified: null | boolean;
  verified_at: null | string;
  verified_by: null | string;
  is_action: boolean;
  post_to_slack: boolean;
  tags: string[];
};

export type PostHogEndpoints = {
  event_definitions: {
    queryParams: undefined;
    response: {
      count: number;
      next: null | string;
      previous: null | string;
      results: PosthogEventType[];
    };
  };
  property_definitions: {
    queryParams?: {
      event_names: string[];
      filter_by_event_names: true;
    };
    response: {
      count: number;
      next: string | null;
      previous: string | null;
      results: Array<{
        id: string;
        name: string;
        is_numerical: boolean;
        property_type: PosthogPropertyType;
        tags: (string | null)[];
        is_seen_on_filtered_events: string;
      }>;
    };
  };
};

function fetchFromPosthog<T extends keyof PostHogEndpoints>(
  endpoint: T,
  options: {
    queryParams?: PostHogEndpoints[T]["queryParams"];
    url?: string;
  } = {}
) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const url = `https://app.posthog.com/api/projects/${posthogProjectId!}/${endpoint}/?${toParams(
    options.queryParams ?? {}
  )}`;
  return fetch(options.url ?? url, {
    method: "GET",
    headers: {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      Authorization: `Bearer ${posthogToken!}`,
    },
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return (await response.json()) as PostHogEndpoints[T]["response"];
  });
}

async function fetchAllPropertiesOfEvent(eventName: string) {
  const result = await fetchFromPosthog("property_definitions", {
    queryParams: {
      event_names: [eventName],
      filter_by_event_names: true,
    },
  });
  let next = result.next;
  while (next) {
    const nextResult = await fetchFromPosthog("property_definitions", {
      url: next,
    });
    result.results.push(...nextResult.results);
    next = nextResult.next;
  }
  return result;
}

async function fetchAllEvents() {
  const result = await fetchFromPosthog("event_definitions");
  let next = result.next;
  while (next) {
    const nextResult = await fetchFromPosthog("event_definitions", {
      url: next,
    });
    result.results.push(...nextResult.results);
    next = nextResult.next;
  }
  return result;
}
import { intro, text, outro } from "@clack/prompts";
intro("@typecharts posthog type generation LI");

async function generate() {
  if (!posthogToken) {
    posthogToken = (
      await text({
        message:
          "No value for POSTHOG_API_KEY found in environment variables. Please enter your PostHog API key",
      })
    ).toString();
  }
  if (!posthogProjectId) {
    posthogProjectId = (
      await text({
        message:
          "No value for POSTHOG_PROJECT_ID found in environment variables. Please enter your PostHog project ID",
      })
    ).toString();
  }
  const data = await fetchAllEvents();
  const events: PostHogEvent[] = [];
  console.log(
    `Starting generation of TypeScript file for ${data.results.length} events...`
  );
  for await (const event of data.results) {
    const definitions = await fetchAllPropertiesOfEvent(event.name);
    console.log(
      `Fetched ${definitions.results.length} properties for event ${event.name}`
    );
    events.push({
      name: event.name,
      properties: definitions.results.map((definition) => {
        return {
          name: definition.name,
          type: definition.property_type,
        };
      }),
    });
  }
  outro(`Generating output file for ${events.length} events...`);
  await generateTypeScriptFile(events);
}

void generate();
