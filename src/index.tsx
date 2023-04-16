import moment from 'moment';
import { queryTodayTimeSpent } from './aw.tsx';
import { Detail } from "@raycast/api";
import { usePromise } from "@raycast/utils";


function fetchTodayTimeSpent(): string {  
  const { isLoading, data, revalidate } = usePromise(
    async () => {
      return await queryTodayTimeSpent();
    },
  );

  return data ? data : 'Loading...';
}

export default function Command() {
  const data = fetchTodayTimeSpent();
  return (
    <Detail
    isLoading={data === undefined}
    markdown={data ? 'Time spent for today: ' + data : 'Loading...'}
      />
  );
}
