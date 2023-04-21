import { queryRecentDaysTimeSpent } from "./aw.tsx";
import { Icon, List } from "@raycast/api";
import { usePromise } from "@raycast/utils";

const NUMBER_OF_DAYS = 7;

function fetchRecentTimeSpent(): string {
  const { data } = usePromise(async () => {
    return await queryRecentDaysTimeSpent(NUMBER_OF_DAYS);
  });

  return data;
}

export default function Command() {
  const data = fetchRecentTimeSpent();
  return (
    <List isLoading={data === undefined} searchBarPlaceholder="Loading your recent time spent...">
      {data && data.map((item) => <List.Item icon={Icon.Clock} title={item.day} subtitle={item.duration} />)}
    </List>
  );
}
