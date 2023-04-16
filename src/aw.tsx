import moment from 'moment';
import axios from 'axios';
import { usePromise } from "@raycast/utils";

// Define the API endpoint URL
const INFO_API_URL = 'http://127.0.0.1:5600/api/0/info';
const BUCKET_API_URL = 'http://127.0.0.1:5600/api/0/buckets';
const QUERY_API_URL = 'http://127.0.0.1:5600/api/0/query';

interface InfoResponse {
  hostname: string;
  version: string;
  testing: boolean;
  device_id: string;
}

interface BucketData {
  id: string;
  created: string;
  name: string | null;
  type: string;
  client: string;
  hostname: string;
  last_updated: string;
}

// Define the request body type
interface QueryRequestBody {
  timeperiods: string[];
  query: string[];
}

// Define the response body type
interface QueryAPIResponse {
  id: null;
  timestamp: string;
  duration: number;
  data: {
    status: string;
  };
}

function secondsToDuration(seconds: number) {
  // Returns a human-readable duration string
  const hrs = Math.floor(seconds / 60 / 60);
  const min = Math.floor((seconds / 60) % 60);
  const sec = Math.floor(seconds % 60);
  const l = [];
  if (hrs != 0) l.push(hrs + 'h');
  if (min != 0) l.push(min + 'm');
  if (sec != 0 || l.length == 0) l.push(sec + 's');
  return l.join(' ');
}

async function fetchHostName(): Promise<string> {
  const response = await axios.get<InfoResponse>(INFO_API_URL, null, {
    headers: {
      'accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
  return response.data.hostname;
}

// Define the function to make the API request
async function queryAPI(requestBody: QueryRequestBody): Promise<QueryResponseBody[][]> {
  try {
    // Make the POST request to the API endpoint
    const response = await axios.post(QUERY_API_URL, requestBody, {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json'
      }
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
    const response: AxiosResponse<{[key: string]: Bucket}> = await axios.get(BUCKET_API_URL, {
      headers: {
        'accept': 'application/json',
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

export async function queryTodayTimeSpent(): string {
  // Get host name
  const hostname = await fetchHostName();

  const afkBucket = await getBucketIdByType('afkstatus', hostname);
  
  // Get the today's time period string
  const offset = 4 * 60 * 60; // the day starts at 4am
  let today = moment().startOf('day').add(offset, 'seconds');
  if (today.isAfter(moment())) {
    today = moment().subtract(1, 'day').startOf('day').add(offset, 'seconds');
  }
  const tomorrow = moment(today).add(24, 'hours');

  const todayPeriod = moment(today).format() + '/' + moment(tomorrow).format();
  const requestBody: QueryRequestBody = {
    timeperiods: [todayPeriod],
    query: [
      'afkbucket = "' + afkBucket + '";',
      'not_afk = flood(query_bucket(afkbucket));',
      'not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);',
      'not_afk = merge_events_by_keys(not_afk, ["status"]);',
      'RETURN = not_afk;',
    ]
  };

  const data = await queryAPI(requestBody);
  const durationInSeconds = data[0][0].duration;
  const formattedDuration = secondsToDuration(durationInSeconds);
  return formattedDuration;
}


