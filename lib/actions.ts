import type {
  BankAccount,
  ChatEmailPrefs,
  CommunityBoard,
  Gathering,
  Message,
  PaymentMethod,
  Role,
  RsvpStatus,
} from "./types";

export type ActionBody =
  | { type: "rsvp"; eventId: string; status: RsvpStatus }
  | { type: "setAttendance"; eventId: string; memberId: string; attended: boolean }
  | {
      type: "createEvent";
      title?: string;
      startsAt: string;
      location?: string;
      hostId: string;
      kibudId?: string;
      lecturerId?: string;
      topic?: string;
      notes?: string;
    }
  | { type: "updateEvent"; eventId: string; patch: Partial<Gathering> }
  | { type: "cancelEvent"; eventId: string }
  | { type: "deleteGathering"; eventId: string }
  | { type: "uploadMedia"; eventId?: string; media: Gathering["media"][number] }
  | { type: "deleteMedia"; eventId?: string; mediaId: string }
  | { type: "saveSummary"; eventId: string; summary?: string; audioUrl?: string }
  | {
      type: "sendMessage";
      id?: string;
      channelId: string;
      text: string;
      quote?: Message["quote"];
      mentions?: string[];
      attachments?: Message["attachments"];
      voiceUrl?: string;
    }
  | { type: "react"; messageId: string; emoji: string }
  | { type: "createPoll"; channelId: string; question: string; options: string[] }
  | { type: "votePoll"; messageId: string; optionId: string }
  | { type: "closePoll"; messageId: string }
  | { type: "deleteMessage"; messageId: string }
  | { type: "editMessage"; messageId: string; text: string }
  | { type: "forwardMessage"; messageId: string; memberId: string }
  | { type: "createDm"; memberId: string }
  | {
      type: "addMember";
      username: string;
      displayName: string;
      phone?: string;
      email?: string;
      role?: Role;
    }
  | {
      type: "updateMember";
      memberId: string;
      patch: {
        username?: string;
        displayName?: string;
        phone?: string;
        email?: string;
        role?: Role;
      };
    }
  | { type: "removeMember"; memberId: string }
  | { type: "setRole"; memberId: string; role: Role }
  | { type: "changePassword"; currentPassword: string; newPassword: string }
  | { type: "resetMemberPassword"; memberId: string }
  | { type: "setBackground"; backgroundImageId: string | null }
  | { type: "addBackground"; url: string; label: string; fromGatheringId?: string }
  | {
      type: "addExpense";
      memberId: string;
      title: string;
      detail?: string;
      amount: number;
      excluded?: boolean;
      eventId?: string | null;
    }
  | {
      type: "updateExpense";
      expenseId: string;
      patch: {
        memberId?: string;
        title?: string;
        detail?: string;
        amount?: number;
        excluded?: boolean;
        eventId?: string | null;
      };
    }
  | { type: "setExpenseExcluded"; expenseId: string; excluded: boolean }
  | { type: "setExpenseExempt"; expenseId: string; memberId: string; exempt: boolean }
  | { type: "setGatheringExempt"; eventId: string; memberId: string; exempt: boolean }
  | { type: "deleteExpense"; expenseId: string }
  | { type: "setExpensesVisible"; visible: boolean }
  | { type: "sendExpenseNotice"; memberId?: string; scope?: string }
  | {
      type: "addPayment";
      fromId: string;
      toId: string;
      amount: number;
      method?: PaymentMethod | null;
      eventId?: string | null;
      note?: string;
    }
  | {
      type: "updatePayment";
      paymentId: string;
      patch: {
        fromId?: string;
        toId?: string;
        amount?: number;
        method?: PaymentMethod | null;
        eventId?: string | null;
        note?: string;
      };
    }
  | { type: "deletePayment"; paymentId: string }
  | { type: "setBankAccount"; memberId: string; account: Partial<BankAccount> | null }
  | { type: "setChatEmailPrefs"; prefs: ChatEmailPrefs }
  | { type: "setCommunityBoard"; board: CommunityBoard }
  | { type: "voteCommunityPoll"; optionId: string };
