export type Role = "admin" | "leader" | "member";

export type RsvpStatus = "yes" | "no" | "maybe" | "pending";

export type MediaType = "image" | "video" | "audio";

export type Member = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  phone: string;
  email: string;
  avatarColor: string;
  initials: string;
  passwordHash?: string;
  mustChangePassword?: boolean;
};

export type EventMedia = {
  id: string;
  type: MediaType;
  url: string;
  caption?: string;
  uploadedBy: string;
  createdAt: string;
};

export type Gathering = {
  id: string;
  title: string;
  startsAt: string;
  location: string;
  hostId: string;
  kibudId?: string;
  lecturerId?: string;
  topic?: string;
  notes?: string;
  summary?: string;
  audioUrl?: string;
  status: "upcoming" | "past" | "cancelled";
  rsvps: Record<string, RsvpStatus>;
  media: EventMedia[];
};

export type ChannelType = "group" | "dm" | "announcements";

export type Channel = {
  id: string;
  name: string;
  type: ChannelType;
  description?: string;
  memberIds: string[];
};

export type Quote = {
  messageId: string;
  authorId: string;
  text: string;
};

export type Attachment = {
  id: string;
  type: MediaType | "file";
  url: string;
  name: string;
};

export type Message = {
  id: string;
  channelId: string;
  authorId: string;
  text: string;
  createdAt: string;
  quote?: Quote;
  reactions: Record<string, string[]>;
  attachments: Attachment[];
  voiceUrl?: string;
  mentions: string[];
};

export type RsvpToken = {
  token: string;
  eventId: string;
  memberId: string;
};

export type BackgroundImage = {
  id: string;
  url: string;
  label: string;
  fromGatheringId?: string;
};

export type AppSettings = {
  groupName: string;
  backgroundImageId: string | null;
  backgrounds: BackgroundImage[];
};

export type EmailLog = {
  id: string;
  eventId: string;
  sentAt: string;
  recipients: string[];
  subject: string;
};

export type IvrLog = {
  id: string;
  at: string;
  phone: string;
  action: string;
  memberId?: string;
  eventId?: string;
  result: string;
};

export type AppState = {
  members: Member[];
  gatherings: Gathering[];
  channels: Channel[];
  messages: Message[];
  tokens: RsvpToken[];
  settings: AppSettings;
  emailLog: EmailLog[];
  ivrLog: IvrLog[];
  revision: number;
};

export type PublicState = Omit<AppState, "tokens"> & {
  me: Member;
};
