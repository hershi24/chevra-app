import type { AppState, EventMedia, Gathering } from "./types";
import { gatheringLabel } from "./format";

export function upcomingGathering(state: AppState | { gatherings: Gathering[] }) {
  const now = Date.now();
  return (
    state.gatherings
      .filter(
        (g) =>
          g.status === "upcoming" &&
          new Date(g.startsAt).getTime() >= now - 3 * 3600_000
      )
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0] ?? null
  );
}

export type GalleryItem = EventMedia & {
  eventId: string;
  eventLabel: string;
};

export function galleryItems(
  state: AppState | { gatherings: Gathering[]; gallery?: EventMedia[] }
): GalleryItem[] {
  const attached = state.gatherings.flatMap((event) =>
    event.media
      .filter((item) => item.type === "image" || item.type === "video" || item.type === "audio")
      .map((item) => ({
        ...item,
        eventId: event.id,
        eventLabel: gatheringLabel(event),
      }))
  );
  const loose = (state.gallery ?? [])
    .filter((item) => item.type === "image" || item.type === "video" || item.type === "audio")
    .map((item) => ({
      ...item,
      eventId: "",
      eventLabel: "ללא שיוך",
    }));
  return [...loose, ...attached];
}

export function dmName(
  channelName: string,
  memberIds: string[],
  myId: string,
  displayName: (id: string) => string
) {
  const other = memberIds.find((id) => id !== myId);
  return other ? displayName(other) : channelName;
}
