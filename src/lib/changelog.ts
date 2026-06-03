import { getCollection, type CollectionEntry } from "astro:content";

export type ChangelogEntry = CollectionEntry<"changelog">;

const changelogDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});
const changelogMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

export async function getChangelogEntries() {
  const entries = await getCollection("changelog");

  return entries.sort(
    (left, right) => right.data.date.getTime() - left.data.date.getTime(),
  );
}

export async function getLatestChangelogEntry() {
  const entries = await getChangelogEntries();

  return entries[0];
}

export function getChangelogUrl(entry: Pick<ChangelogEntry, "id">) {
  return `/changelog/${entry.id}`;
}

export function formatChangelogDate(date: Date) {
  return changelogDateFormatter.format(date);
}

export function formatChangelogMonth(date: Date) {
  return changelogMonthFormatter.format(date);
}
