import type { AppState, CommunityBoard, PublicState } from "./types";
import { galleryItems } from "./selectors";

export function boardEnabled(
  state: { settings?: { communityBoard?: { enabled?: boolean } | null } } | null | undefined
) {
  return state?.settings?.communityBoard?.enabled === true;
}

export function defaultBoard(): CommunityBoard {
  return {
    enabled: false,
    notices: [
      {
        id: "n1",
        title: "שיעור החבורה",
        body: "ההתכנסות הקרובה, השעה והמקום מופיעים בראש הלוח. מחכים לכל החברים.",
      },
      {
        id: "n2",
        title: "דפי מקורות",
        body: "דפי הלימוד להוראה ולהדפסה נמצאים למטה, וניתן לפתוח אותם ישירות.",
      },
    ],
    prayers: [
      { id: "p1", name: "שחרית", time: "06:30" },
      { id: "p2", name: "מנחה", time: "13:15" },
      { id: "p3", name: "ערבית", time: "19:40" },
      { id: "p4", name: "שיעור", time: "20:30" },
    ],
    files: [
      { id: "f1", title: "דף לימוד", url: "/materials/daf-limud.pdf" },
      { id: "f2", title: "מודעה לחבורה", url: "/materials/hodaah.pdf" },
    ],
    poll: {
      question: "איזו מתנה נביא לראש החבורה?",
      closed: false,
      options: [
        { id: "o1", label: "ספר קודש", voterIds: [] },
        { id: "o2", label: "סט גביעים", voterIds: [] },
        { id: "o3", label: "תרומה לצדקה", voterIds: [] },
      ],
    },
    photoIds: [],
  };
}

export function cleanBoardText(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanId(value: unknown, fallback: string) {
  const id = String(value ?? "").trim().slice(0, 80);
  return id || fallback;
}

function cleanUrl(value: unknown) {
  const url = String(value ?? "").trim().slice(0, 400);
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  if (/^https:\/\/[^\s]+$/i.test(url)) return url;
  return "";
}

export function normalizeBoard(value: unknown, members: { id: string }[] = []): CommunityBoard {
  const base = defaultBoard();
  const raw = value && typeof value === "object" ? (value as Partial<CommunityBoard>) : {};
  const memberIds = new Set(members.map((member) => member.id));

  const notices = Array.isArray(raw.notices) && raw.notices.length ? raw.notices : base.notices;
  const prayers = Array.isArray(raw.prayers) && raw.prayers.length ? raw.prayers : base.prayers;
  const files = Array.isArray(raw.files) && raw.files.length ? raw.files : base.files;
  const poll = raw.poll && typeof raw.poll === "object" ? raw.poll : base.poll;
  const options = Array.isArray(poll.options) ? poll.options : base.poll.options;

  return {
    enabled: raw.enabled === true,
    notices: notices
      .slice(0, 8)
      .map((item, index) => ({
        id: cleanId(item?.id, `n${index + 1}`),
        title: cleanBoardText(item?.title, 80),
        body: cleanBoardText(item?.body, 500),
      }))
      .filter((item) => item.title || item.body),
    prayers: prayers
      .slice(0, 8)
      .map((item, index) => ({
        id: cleanId(item?.id, `p${index + 1}`),
        name: cleanBoardText(item?.name, 40),
        time: cleanBoardText(item?.time, 20),
      }))
      .filter((item) => item.name && item.time),
    files: files
      .slice(0, 6)
      .map((item, index) => ({
        id: cleanId(item?.id, `f${index + 1}`),
        title: cleanBoardText(item?.title, 80),
        url: cleanUrl(item?.url),
      }))
      .filter((item) => item.title && item.url),
    poll: {
      question: cleanBoardText(poll.question, 120) || base.poll.question,
      closed: poll.closed === true,
      options: options
        .slice(0, 6)
        .map((item, index) => ({
          id: cleanId(item?.id, `o${index + 1}`),
          label: cleanBoardText(item?.label, 40),
          voterIds: Array.isArray(item?.voterIds)
            ? item.voterIds.filter((id): id is string => typeof id === "string" && memberIds.has(id))
            : [],
        }))
        .filter((item) => item.label),
    },
    photoIds: Array.isArray(raw.photoIds)
      ? [...new Set(raw.photoIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))].slice(0, 24)
      : [],
  };
}

export function resolveBoard(state: Pick<AppState, "settings" | "members"> | Pick<PublicState, "settings" | "members">) {
  const stored = state.settings.communityBoard;
  if (!stored) return defaultBoard();
  const board = normalizeBoard(stored, state.members);
  if (board.notices.length === 0) board.notices = defaultBoard().notices;
  if (board.prayers.length === 0) board.prayers = defaultBoard().prayers;
  if (board.files.length === 0) board.files = defaultBoard().files;
  if (board.poll.options.length < 2) board.poll = defaultBoard().poll;
  return board;
}

export function boardPhotos(state: Pick<AppState, "settings" | "members" | "gatherings" | "gallery">) {
  const ids = new Set(resolveBoard(state).photoIds);
  if (!ids.size) return [];
  return galleryItems(state).filter((item) => item.type === "image" && ids.has(item.id));
}
