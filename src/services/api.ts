import {
  CalendarEvent,
  TelegramConfig,
  RealtimeMessage,
  AdminNotification,
  MonthlyCalendarPostPayload,
  MonthlyCalendarPostResponse,
  AuthUser,
  AuthConfig,
} from '../types';

export async function fetchEvents(): Promise<{ events: CalendarEvent[]; notifications: AdminNotification[] }> {
  const res = await fetch('/api/events');
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

export async function submitGoogleFormWebhook(payload: Record<string, any>): Promise<{ success: boolean; event: CalendarEvent; telegramNotified: boolean }> {
  const res = await fetch('/api/webhooks/google-form', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit form event');
  }
  return res.json();
}

export async function submitEventDirect(
  eventData: Partial<CalendarEvent>
): Promise<{ success: boolean; event: CalendarEvent; series?: CalendarEvent[]; totalCreated?: number }> {
  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit event');
  }
  return res.json();
}

export async function approveEvent(
  id: string,
  approvedBy = 'Administrator',
  updates?: Partial<CalendarEvent>,
  options?: { applyToSeries?: boolean }
): Promise<{ success: boolean; event: CalendarEvent; approvedCount?: number }> {
  const res = await fetch(`/api/events/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      approvedBy,
      updates,
      applyToSeries: options?.applyToSeries ?? true,
    }),
  });
  if (!res.ok) throw new Error('Failed to approve event');
  return res.json();
}

export async function rejectEvent(
  id: string,
  reason?: string,
  options?: { applyToSeries?: boolean }
): Promise<{ success: boolean; event: CalendarEvent }> {
  const res = await fetch(`/api/events/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reason,
      applyToSeries: options?.applyToSeries ?? true,
    }),
  });
  if (!res.ok) throw new Error('Failed to reject event');
  return res.json();
}

export async function updateEvent(
  id: string,
  patch: Partial<CalendarEvent>,
  options?: { scope?: 'single' | 'series' }
): Promise<{ success: boolean; event: CalendarEvent; updatedCount?: number }> {
  const res = await fetch(`/api/events/${id}?scope=${options?.scope || 'single'}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...patch, scope: options?.scope || 'single' }),
  });
  if (!res.ok) throw new Error('Failed to update event');
  return res.json();
}

export async function deleteEvent(
  id: string,
  options?: { scope?: 'single' | 'series' }
): Promise<{ success: boolean; eventId?: string; deletedCount?: number; seriesId?: string }> {
  const url = `/api/events/${encodeURIComponent(id)}?scope=${options?.scope || 'single'}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to delete event');
  }
  return res.json();
}

export async function fetchTelegramSettings(): Promise<TelegramConfig & { hasBotToken: boolean; maskedToken: string }> {
  const res = await fetch('/api/telegram/settings');
  if (!res.ok) throw new Error('Failed to fetch Telegram settings');
  return res.json();
}

export async function saveTelegramSettings(settings: Partial<TelegramConfig>): Promise<{ success: boolean; isConfigured: boolean }> {
  const res = await fetch('/api/telegram/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update Telegram settings');
  return res.json();
}

export async function testTelegramConnection(
  botToken?: string,
  chatId?: string,
  targetType: 'admin' | 'events' = 'admin',
  topicId?: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/telegram/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      botToken,
      adminChatId: targetType === 'admin' ? chatId : undefined,
      eventsChatId: targetType === 'events' ? chatId : undefined,
      adminTopicId: targetType === 'admin' ? topicId : undefined,
      eventsTopicId: targetType === 'events' ? topicId : undefined,
      topicId,
      targetType,
    }),
  });
  return res.json();
}

export async function postApprovedEventToTelegram(
  eventId: string,
  targetChatId?: string,
  targetTopicId?: string
): Promise<{ success: boolean; error?: string; postedToChat?: string; postedToTopic?: string }> {
  const res = await fetch('/api/telegram/post-approved-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, targetChatId, targetTopicId }),
  });
  return res.json();
}

export async function postMonthlyCalendarToTelegram(
  payload: MonthlyCalendarPostPayload
): Promise<MonthlyCalendarPostResponse> {
  const res = await fetch('/api/telegram/post-monthly-calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to post monthly calendar to Telegram');
  }
  return res.json();
}

export async function sendTelegramReminder(
  eventId?: string,
  targetChatId?: string,
  targetTopicId?: string
): Promise<{ success: boolean; error?: string; message?: string; postedToChat?: string; postedToTopic?: string }> {
  const res = await fetch('/api/telegram/reminders/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, targetChatId, targetTopicId }),
  });
  return res.json();
}

export async function fetchGoogleScriptCode(): Promise<string> {
  const res = await fetch('/api/google-form-script');
  if (!res.ok) throw new Error('Failed to fetch script');
  return res.text();
}

export async function markNotificationsRead(): Promise<void> {
  await fetch('/api/notifications/read-all', { method: 'POST' });
}

export function subscribeToRealtimeEvents(
  onMessage: (msg: RealtimeMessage) => void,
  onStatusChange?: (status: 'connected' | 'connecting' | 'disconnected') => void
): () => void {
  let eventSource: EventSource | null = null;
  let isUnmounted = false;
  let reconnectTimeout: any = null;

  function connect() {
    if (isUnmounted) return;
    onStatusChange?.('connecting');

    eventSource = new EventSource('/api/events/stream');

    eventSource.onopen = () => {
      onStatusChange?.('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (err) {
        console.error('Failed to parse SSE event data:', err);
      }
    };

    eventSource.onerror = () => {
      onStatusChange?.('disconnected');
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (!isUnmounted) {
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };
  }

  connect();

  return () => {
    isUnmounted = true;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}

// ----------------------------------------------------
// Authentication API
// ----------------------------------------------------

export async function fetchAuthConfig(): Promise<AuthConfig> {
  const res = await fetch('/api/auth/config');
  if (!res.ok) throw new Error('Failed to fetch authentication config');
  return res.json();
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

export async function loginWithGoogle(credential: string): Promise<{ success: boolean; user: AuthUser; token?: string }> {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to authenticate with Google');
  }
  return res.json();
}

export async function logout(): Promise<{ success: boolean }> {
  const res = await fetch('/api/auth/logout', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to log out');
  return res.json();
}

export async function devLogin(
  role: 'admin' | 'user' = 'admin',
  email?: string,
  name?: string
): Promise<{ success: boolean; user: AuthUser }> {
  const res = await fetch('/api/auth/dev-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, email, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to perform dev login');
  }
  return res.json();
}
