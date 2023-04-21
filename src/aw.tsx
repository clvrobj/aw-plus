import moment from "moment";
import axios from "axios";

// Define the API endpoint URL
const INFO_API_URL = "http://127.0.0.1:5600/api/0/info";
const BUCKET_API_URL = "http://127.0.0.1:5600/api/0/buckets";
const QUERY_API_URL = "http://127.0.0.1:5600/api/0/query";

interface InfoResponse {
  hostname: string;
  version: string;
  testing: boolean;
  device_id: string;
}

// Define the request body type
interface QueryRequestBody {
  timeperiods: string[];
  query: string[];
}

interface TimeSpentData {
  day: string;
  duration: string;
}

function secondsToDuration(seconds: number) {
  // Returns a human-readable duration string
  const hrs = Math.floor(seconds / 60 / 60);
  const min = Math.floor((seconds / 60) % 60);
  const sec = Math.floor(seconds % 60);
  const l = [];
  if (hrs != 0) l.push(hrs + "h");
  if (min != 0) l.push(min + "m");
  if (sec != 0 || l.length == 0) l.push(sec + "s");
  return l.join(" ");
}

async function fetchHostName(): Promise<string> {
  const response = await axios.get<InfoResponse>(INFO_API_URL, null, {
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  return response.data.hostname;
}

// Define the function to make the API request
async function queryAPI(requestBody: QueryRequestBody): Promise<QueryResponseBody[][]> {
  try {
    // Make the POST request to the API endpoint
    const response = await axios.post(QUERY_API_URL, requestBody, {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    // Return the response data
    return response.data;
  } catch (error) {
    // Handle any errors that occur during the request
    throw error;
  }
}

async function getBucketIdByType(bucketType: string, hostname: string): Promise<string | undefined> {
  try {
    const response: AxiosResponse<{ [key: string]: Bucket }> = await axios.get(BUCKET_API_URL, {
      headers: {
        accept: "application/json",
      },
    });
    const buckets = response.data;
    for (const key in buckets) {
      const bucket = buckets[key];
      if (bucket.type === bucketType && bucket.hostname === hostname) {
        return bucket.id;
      }
    }
    return undefined;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

async function queryTimeSpent(timeperiods: string[]): string[] {
  // Get host name
  const hostname = await fetchHostName();

  const afkBucket = await getBucketIdByType("afkstatus", hostname);

  const requestBody: QueryRequestBody = {
    timeperiods: timeperiods,
    query: [
      'afkbucket = "' + afkBucket + '";',
      "not_afk = flood(query_bucket(afkbucket));",
      'not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);',
      'not_afk = merge_events_by_keys(not_afk, ["status"]);',
      "RETURN = not_afk;",
    ],
  };

  const formattedDurations: string[] = [];
  const data = await queryAPI(requestBody);
  for (let i = 0; i < data.length; i++) {
    if (data[i].length == 0) {
      formattedDurations.push("0s");
      continue;
    }
    const durationInSeconds = data[i][0].duration;
    const formattedDuration = secondsToDuration(durationInSeconds);
    formattedDurations.push(formattedDuration);
  }
  return formattedDurations;
}

export async function queryTodayTimeSpent(): TimeSpentData[] {
  // Get the today's time period string
  const offset = 4 * 60 * 60; // the day starts at 4am
  let today = moment().startOf("day").add(offset, "seconds");
  if (today.isAfter(moment())) {
    today = moment().subtract(1, "day").startOf("day").add(offset, "seconds");
  }
  const tomorrow = moment(today).add(24, "hours");

  const todayPeriod = moment(today).format() + "/" + moment(tomorrow).format();
  const timeperiods = [todayPeriod];
  const durations = await queryTimeSpent(timeperiods);
  return [{ day: "Today", duration: durations[0] }];
}

export async function queryRecentDaysTimeSpent(days: number): TimeSpentData[] {
  const offset = 4 * 60 * 60; // the day starts at 4am
  let today = moment().startOf("day").add(offset, "seconds");
  if (today.isAfter(moment())) {
    today = moment().subtract(1, "day").startOf("day").add(offset, "seconds");
  }
  const timeperiods = [];
  for (let i = 0; i < days; i++) {
    const start = moment(today).subtract(i, "days");
    const end = moment(today).subtract(i - 1, "days");
    const period = moment(start).format() + "/" + moment(end).format();
    timeperiods.push(period);
  }
  const durations = await queryTimeSpent(timeperiods);
  const timeSpentData: TimeSpentData[] = [];
  for (let i = 0; i < days; i++) {
    const duration = durations[i];
    const day = moment(today).subtract(i, "days").format("ddd, MMM D");
    timeSpentData.push({ day: day, duration: duration });
  }
  return timeSpentData;
}
