export type EventCategory =
  | 'SAKK Event'
  | 'SAKK meeting'
  | 'Member Event (18+)'
  | 'Member EVent (21+)'
  | 'celebration'
  | 'other';

export type EventStatus = 'pending' | 'approved' | 'rejected';

export type RecurrenceFrequency =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly_weekday'
  | 'monthly_date'
  | 'yearly'
  | 'custom';

export type WeekOfMonth = 1 | 2 | 3 | 4 | -1; // 1=1st, 2=2nd, 3=3rd, 4=4th, -1=Last
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday ... 6=Saturday

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval?: number; // e.g. every 1 month, every 2 weeks
  weekOfMonth?: WeekOfMonth; // e.g. 1st, 3rd, -1 (Last)
  dayOfWeek?: DayOfWeek; // e.g. 5 for Friday, 0 for Sunday
  daysOfWeek?: DayOfWeek[]; // for weekly multi-day selection (e.g. Mon, Wed, Fri)
  dayOfMonth?: number; // for monthly_date (e.g. 15th)
  endType: 'occurrences' | 'until_date';
  occurrences?: number; // e.g. 6 or 12 occurrences
  untilDate?: string; // 'YYYY-MM-DD'
  humanReadable?: string; // e.g. "Every 1st Friday of the month (6 times)"
}

export interface CalendarEvent {
  id: string;
  title: string;
  category: EventCategory;
  date: string; // 'YYYY-MM-DD' (Start date)
  endDate?: string; // 'YYYY-MM-DD' (Optional end date for multi-day events)
  isMultiDay?: boolean;
  startTime: string; // 'HH:MM' (24h)
  endTime: string; // 'HH:MM' (24h)
  status: EventStatus;
  submitterName: string;
  submitterEmail: string;
  location: string; // physical venue or virtual meeting link
  description: string;
  expectedAttendees?: string | number;
  equipmentNeeds?: string;
  notes?: string;
  submittedAt: string; // ISO string
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  source: 'google_form' | 'direct_submission' | 'system';
  rawFormAnswers?: Record<string, string>;
  telegramNotified?: boolean;
  telegramDestination?: {
    chatId: string;
    topicId?: string;
    type: 'submission' | 'approval';
    timestamp?: string;
  };

  // Recurrence properties
  isRecurring?: boolean;
  recurringSeriesId?: string;
  recurrenceRule?: RecurrenceRule;
  recurrenceIndex?: number; // 1-based index (e.g. 1 of 6)
  recurrenceTotal?: number; // total in series (e.g. 6)
}

export interface TelegramConfig {
  botToken: string;
  adminChatId: string; // Admin chat for form submissions & approvals
  adminTopicId?: string; // Optional message_thread_id for admin approvals topic
  eventsChatId?: string; // Separate public/community chat for approved event announcements & calendar posts
  eventsTopicId?: string; // Optional message_thread_id for community events topic
  channelChatId?: string; // Legacy fallback/alias
  notifyOnSubmission: boolean;
  notifyOnApproval: boolean;
  notifyOnReschedule: boolean;
  notifyDailyReminders?: boolean;
  notifyMonthlyCalendar?: boolean;
  monthlyPostDay?: number; // Day of the month to post (1-28)
  includeCalendarImage?: boolean;
  isConfigured: boolean;
  lastMonthlyPost?: {
    timestamp: string;
    chatId: string;
    topicId?: string;
    success: boolean;
    hasImage: boolean;
    message?: string;
  };
  lastTestStatus?: {
    success: boolean;
    timestamp: string;
    message?: string;
  };
}

export interface MonthlyCalendarPostPayload {
  month: number; // 0-11
  year: number;
  monthName: string;
  imageBase64?: string;
  customNote?: string;
  targetChatId?: string;
  targetTopicId?: string;
}

export interface MonthlyCalendarPostResponse {
  success: boolean;
  message?: string;
  error?: string;
  postedToChat?: string;
  postedToTopic?: string;
  hasPhoto?: boolean;
}

export interface RealtimeMessage {
  type:
    | 'INIT'
    | 'EVENT_SUBMITTED'
    | 'EVENT_APPROVED'
    | 'EVENT_REJECTED'
    | 'EVENT_UPDATED'
    | 'EVENT_DELETED'
    | 'TELEGRAM_CONFIG_UPDATED';
  event?: CalendarEvent;
  events?: CalendarEvent[];
  seriesEvents?: CalendarEvent[];
  eventId?: string;
  seriesId?: string;
  deletedCount?: number;
  notification?: AdminNotification;
  message?: string;
  timestamp: string;
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'submission' | 'approval' | 'rejection' | 'reschedule' | 'telegram';
  eventId?: string;
  timestamp: string;
  read: boolean;
}

export interface CategoryMeta {
  id: EventCategory;
  label: string;
  bgLight: string;
  bgSolid: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
  hex: string;
}

export interface AuthUser {
  email: string;
  name: string;
  picture?: string;
  role: 'admin' | 'user';
}

export interface AuthConfig {
  googleClientId: string;
  hasGoogleAuth: boolean;
  adminConfigured: boolean;
}
