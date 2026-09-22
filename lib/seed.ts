import type {
  AppState,
  Channel,
  Gathering,
  Member,
  Message,
  RsvpStatus,
} from "./types";

function atHour(base: Date, hour: number, minute = 0) {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function nextWeekday(from: Date, weekday: number, hour: number, minute: number) {
  const d = new Date(from);
  const add = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + add);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const COLORS = [
  "#0F766E",
  "#B45309",
  "#1D4ED8",
  "#7C3AED",
  "#BE123C",
  "#047857",
  "#C2410C",
  "#0E7490",
];

export function createSeed(): AppState {
  const now = new Date();

  const members: Member[] = [
    {
      id: "m-david",
      username: "דוד",
      displayName: "דוד כהן",
      role: "admin",
      phone: "0501112233",
      email: "david@chevra.local",
      avatarColor: COLORS[0],
      initials: "דכ",
    },
    {
      id: "m-moshe",
      username: "משה",
      displayName: "משה לוי",
      role: "leader",
      phone: "0502223344",
      email: "moshe@chevra.local",
      avatarColor: COLORS[1],
      initials: "מל",
    },
    {
      id: "m-yossi",
      username: "יוסף",
      displayName: "יוסף גולדשטיין",
      role: "member",
      phone: "0503334455",
      email: "yossi@chevra.local",
      avatarColor: COLORS[2],
      initials: "יג",
    },
    {
      id: "m-avraham",
      username: "אברהם",
      displayName: "אברהם שפירא",
      role: "member",
      phone: "0504445566",
      email: "avraham@chevra.local",
      avatarColor: COLORS[3],
      initials: "אש",
    },
    {
      id: "m-yaakov",
      username: "יעקב",
      displayName: "יעקב רוזנברג",
      role: "member",
      phone: "0505556677",
      email: "yaakov@chevra.local",
      avatarColor: COLORS[4],
      initials: "יר",
    },
    {
      id: "m-shlomo",
      username: "שלמה",
      displayName: "שלמה פרידמן",
      role: "member",
      phone: "0506667788",
      email: "shlomo@chevra.local",
      avatarColor: COLORS[5],
      initials: "שפ",
    },
    {
      id: "m-natan",
      username: "נתן",
      displayName: "נתן ברקוביץ",
      role: "member",
      phone: "0507778899",
      email: "natan@chevra.local",
      avatarColor: COLORS[6],
      initials: "נב",
    },
    {
      id: "m-chaim",
      username: "חיים",
      displayName: "חיים וייס",
      role: "member",
      phone: "0508889900",
      email: "chaim@chevra.local",
      avatarColor: COLORS[7],
      initials: "חו",
    },
  ];

  const ids = members.map((m) => m.id);

  function rsvps(
    yes: string[],
    no: string[] = [],
    maybe: string[] = []
  ): Record<string, RsvpStatus> {
    const map: Record<string, RsvpStatus> = {};
    for (const id of ids) map[id] = "pending";
    for (const id of yes) map[id] = "yes";
    for (const id of no) map[id] = "no";
    for (const id of maybe) map[id] = "maybe";
    return map;
  }

  const upcomingAt = nextWeekday(now, 3, 20, 30);
  const past1 = atHour(addDays(now, -18), 20, 30);
  const past2 = atHour(addDays(now, -39), 21, 0);
  const past3 = atHour(addDays(now, -60), 20, 15);

  const gatherings: Gathering[] = [
    {
      id: "g-next",
      title: "חברותא · פרשת השבוע",
      startsAt: upcomingAt.toISOString(),
      location: "בית כהן, רחוב הנריטה סולד 12, ירושלים",
      hostId: "m-david",
      kibudId: "m-shlomo",
      lecturerId: "m-moshe",
      topic: "אהבת ישראל — איך שומרים על חברות אמיתית",
      notes: "נכנסים מהחניה האחורית. נא להגיע בזמן כדי להתחיל בלימוד ב־20:30.",
      status: "upcoming",
      rsvps: rsvps(
        ["m-david", "m-moshe", "m-yossi", "m-avraham", "m-shlomo"],
        ["m-chaim"],
        ["m-natan"]
      ),
      media: [],
    },
    {
      id: "g-past-1",
      title: "חברותא · בין אדם לחברו",
      startsAt: past1.toISOString(),
      location: "בית לוי, רחוב עמק רפאים 8",
      hostId: "m-moshe",
      kibudId: "m-yossi",
      lecturerId: "m-moshe",
      topic: "בין אדם לחברו בחיי נישואין",
      summary:
        "דיברנו על הקשבה בבית — איך החברותא שלנו מלמדת אותנו גם להיות נוכחים יותר בזוגיות. משה הביא מקורות מפרקי אבות ומהרב וולבה. בסוף ישבנו על תה ועוגה של יוסי.",
      status: "past",
      rsvps: rsvps(ids.filter((id) => id !== "m-natan"), ["m-natan"]),
      media: [
        {
          id: "img-1",
          type: "image",
          url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80",
          caption: "שולחן הכיבוד אחרי השיעור",
          uploadedBy: "m-yossi",
          createdAt: past1.toISOString(),
        },
        {
          id: "img-2",
          type: "image",
          url: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1400&q=80",
          caption: "ספרים על השולחן",
          uploadedBy: "m-david",
          createdAt: past1.toISOString(),
        },
      ],
    },
    {
      id: "g-past-2",
      title: "טיול משפחות · עמק האלה",
      startsAt: past2.toISOString(),
      location: "חניון בריכת המלך, עמק האלה",
      hostId: "m-avraham",
      kibudId: "m-yaakov",
      topic: "שבת בטבע עם החבורה",
      summary:
        "יצאנו עם הילדים לפיקניק קצר. מזג האוויר היה מושלם, והילדים רצו בין העצים בזמן שהחברים ישבו במעגל.",
      status: "past",
      rsvps: rsvps(ids),
      media: [
        {
          id: "img-3",
          type: "image",
          url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80",
          caption: "הנוף מהשביל",
          uploadedBy: "m-avraham",
          createdAt: past2.toISOString(),
        },
        {
          id: "img-4",
          type: "image",
          url: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1400&q=80",
          caption: "כולם ביחד",
          uploadedBy: "m-yaakov",
          createdAt: past2.toISOString(),
        },
        {
          id: "vid-1",
          type: "video",
          url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
          caption: "קליפ קצר מהטיול",
          uploadedBy: "m-natan",
          createdAt: past2.toISOString(),
        },
      ],
    },
    {
      id: "g-past-3",
      title: "חברותא · שמחה של מצווה",
      startsAt: past3.toISOString(),
      location: "בית גולדשטיין, רחוב כובשי קטמון 4",
      hostId: "m-yossi",
      kibudId: "m-chaim",
      lecturerId: "m-moshe",
      topic: "שמחה של מצווה — לא רק בחגים",
      summary: "שיעור רגוע עם הרבה שאלות מהחיים. חיים הביא בורקס וסלט, וכולם נשארו עד מאוחר.",
      audioUrl: undefined,
      status: "past",
      rsvps: rsvps(ids.filter((id) => id !== "m-shlomo"), ["m-shlomo"]),
      media: [
        {
          id: "img-5",
          type: "image",
          url: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1400&q=80",
          caption: "ערב בבית יוסי",
          uploadedBy: "m-chaim",
          createdAt: past3.toISOString(),
        },
      ],
    },
  ];

  const channels: Channel[] = [
    {
      id: "c-general",
      name: "כללי",
      type: "group",
      description: "שיחת החבורה היומיומית",
      memberIds: ids,
    },
    {
      id: "c-announce",
      name: "הודעות רשמיות",
      type: "announcements",
      description: "עדכונים ממנהל המערכת ומגיד השיעור",
      memberIds: ids,
    },
    {
      id: "c-kibud",
      name: "תיאום כיבוד",
      type: "group",
      description: "מי מביא מה לחברה",
      memberIds: ids,
    },
    {
      id: "c-outings",
      name: "טיולים",
      type: "group",
      description: "רעיונות ליציאות משפחות",
      memberIds: ids,
    },
    {
      id: "c-dm-david-moshe",
      name: "דוד ומשה",
      type: "dm",
      memberIds: ["m-david", "m-moshe"],
    },
    {
      id: "c-dm-david-yossi",
      name: "דוד ויוסף",
      type: "dm",
      memberIds: ["m-david", "m-yossi"],
    },
  ];

  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

  const messages: Message[] = [
    {
      id: "msg-1",
      channelId: "c-announce",
      authorId: "m-david",
      text: "חברים, החברה הבאה בבית שלנו ביום רביעי ב־20:30. משה יגיד שיעור על אהבת ישראל.",
      createdAt: hoursAgo(30),
      reactions: { "🙏": ["m-moshe", "m-yossi", "m-avraham"] },
      attachments: [],
      mentions: [],
    },
    {
      id: "msg-2",
      channelId: "c-announce",
      authorId: "m-moshe",
      text: "אשמח אם תסתכלו קצת בפרקי אבות ב׳ לפני כן. לא חובה — רק אם יש זמן.",
      createdAt: hoursAgo(28),
      reactions: { "👍": ["m-david", "m-shlomo"] },
      attachments: [],
      mentions: [],
    },
    {
      id: "msg-3",
      channelId: "c-kibud",
      authorId: "m-shlomo",
      text: "אני על הכיבוד הפעם. חושב על עוגה, פירות ושתיה קלה. מישהו אלרגי למשהו?",
      createdAt: hoursAgo(20),
      reactions: {},
      attachments: [],
      mentions: [],
    },
    {
      id: "msg-4",
      channelId: "c-kibud",
      authorId: "m-yaakov",
      text: "רק בלי אגוזים אצלנו בבית, תודה רבה!",
      createdAt: hoursAgo(19),
      quote: {
        messageId: "msg-3",
        authorId: "m-shlomo",
        text: "מישהו אלרגי למשהו?",
      },
      reactions: { "❤️": ["m-shlomo"] },
      attachments: [],
      mentions: [],
    },
    {
      id: "msg-5",
      channelId: "c-general",
      authorId: "m-yossi",
      text: "איזו חברה הייתה בפעם הקודמת. עדיין חושב על מה שמשה אמר על הקשבה בבית.",
      createdAt: hoursAgo(10),
      reactions: { "✨": ["m-moshe", "m-david"] },
      attachments: [],
      mentions: ["m-moshe"],
    },
    {
      id: "msg-6",
      channelId: "c-general",
      authorId: "m-avraham",
      text: "@חיים וייס מקווים שתצליח להגיע בפעם הבאה. החסרת!",
      createdAt: hoursAgo(8),
      reactions: {},
      attachments: [],
      mentions: ["m-chaim"],
    },
    {
      id: "msg-7",
      channelId: "c-general",
      authorId: "m-chaim",
      text: "גם אני מצטער. התינוק לא נתן לישון. אשתדל בבא.",
      createdAt: hoursAgo(7.5),
      quote: {
        messageId: "msg-6",
        authorId: "m-avraham",
        text: "מקווים שתצליח להגיע בפעם הבאה.",
      },
      reactions: { "🙏": ["m-avraham", "m-yossi", "m-david"] },
      attachments: [],
      mentions: [],
    },
    {
      id: "msg-8",
      channelId: "c-outings",
      authorId: "m-natan",
      text: "יש רעיון לטיול הבא: גן לאומי קסטל בשעות הבוקר. קצר, יפה, וקל עם עגלות.",
      createdAt: hoursAgo(5),
      reactions: { "🔥": ["m-avraham", "m-yaakov"] },
      attachments: [],
      mentions: [],
    },
    {
      id: "msg-9",
      channelId: "c-dm-david-moshe",
      authorId: "m-david",
      text: "משה, תודה שאתה מכין את השיעור. צריך משהו מהבית?",
      createdAt: hoursAgo(4),
      reactions: {},
      attachments: [],
      mentions: [],
    },
    {
      id: "msg-10",
      channelId: "c-dm-david-moshe",
      authorId: "m-moshe",
      text: "רק שקט לשעה בערב להכנה 😄 נתראה רביעי.",
      createdAt: hoursAgo(3.5),
      reactions: { "👍": ["m-david"] },
      attachments: [],
      mentions: [],
    },
  ];

  const tokens = members.map((m) => ({
    token: `tok-${m.id}-g-next`,
    eventId: "g-next",
    memberId: m.id,
  }));

  return {
    members,
    gatherings,
    channels,
    messages,
    tokens,
    settings: {
      groupName: "מיין חברה",
      backgroundImageId: "bg-1",
      backgrounds: [
        {
          id: "bg-1",
          url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1800&q=80",
          label: "שולחן החבורה · בית לוי",
          fromGatheringId: "g-past-1",
        },
        {
          id: "bg-2",
          url: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1800&q=80",
          label: "טיול משפחות · עמק האלה",
          fromGatheringId: "g-past-2",
        },
        {
          id: "bg-3",
          url: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1800&q=80",
          label: "ערב בבית יוסי",
          fromGatheringId: "g-past-3",
        },
        {
          id: "bg-4",
          url: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1800&q=80",
          label: "לימוד עם ספרים",
          fromGatheringId: "g-past-1",
        },
      ],
    },
    emailLog: [],
    ivrLog: [],
    revision: 1,
  };
}
