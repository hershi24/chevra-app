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
  size?: number;
};

export type PollOption = {
  id: string;
  label: string;
  voterIds: string[];
};

export type Poll = {
  question: string;
  options: PollOption[];
  closed: boolean;
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
  poll?: Poll;
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

export type Expense = {
  id: string;
  memberId: string;
  createdBy: string;
  title: string;
  detail: string;
  amount: number;
  excluded: boolean;
  eventId?: string;
  createdAt: string;
};

export type PaymentMethod = "cash" | "transfer";

export type ExpensePayment = {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  method?: PaymentMethod;
  eventId?: string;
  note: string;
  createdBy: string;
  createdAt: string;
};

export type BankAccount = {
  holder: string;
  bank: string;
  branch: string;
  account: string;
  phone: string;
  note: string;
  updatedAt: string;
};

export type AppSettings = {
  groupName: string;
  backgroundImageId: string | null;
  backgrounds: BackgroundImage[];
  showExpenses?: boolean;
};

export type EmailDelivery = {
  to: string;
  name: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
};

export type EmailLog = {
  id: string;
  eventId: string;
  sentAt: string;
  recipients: string[];
  subject: string;
  deliveries?: EmailDelivery[];
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
  gallery: EventMedia[];
  channels: Channel[];
  messages: Message[];
  tokens: RsvpToken[];
  settings: AppSettings;
  expenses: Expense[];
  payments?: ExpensePayment[];
  bankAccounts?: Record<string, BankAccount>;
  emailLog: EmailLog[];
  ivrLog: IvrLog[];
  chatReads?: Record<string, Record<string, string>>;
  revision: number;
};

export type PublicState = Omit<AppState, "tokens" | "chatReads"> & {
  me: Member;
};
