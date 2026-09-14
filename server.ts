import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { OAuth2Client } from 'google-auth-library';
import { createServer as createViteServer } from 'vite';
import { calculateRecurringDates, formatRecurrenceLabel } from './src/utils/recurrence';
import { calculateDaysBetween, formatEventDateRange } from './src/constants';
import { RecurrenceRule } from './src/types';
import {
  loadEvents,
  saveEvents,
  loadNotifications,
  saveNotifications,
  createStartupBackup,
} from './src/server/storage';

export interface AuthUser {
  email: string;
  name: string;
  picture?: string;
  role: 'admin' | 'user';
}

interface CalendarEvent {
  id: string;
  title: string;
  category: string;
  date: string;
  endDate?: string;
  isMultiDay?: boolean;
  startTime: string;
  endTime: string;
  status: 'pending' | 'approved' | 'rejected';
  submitterName: string;
  submitterEmail: string;
  location: string;
  description: string;
  expectedAttendees?: string | number;
  equipmentNeeds?: string;
  notes?: string;
  submittedAt: string;
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
  recurrenceIndex?: number;
  recurrenceTotal?: number;
}

interface TelegramConfig {
  botToken: string;
  adminChatId: string; // Admin chat for incoming submission alerts & approvals
  adminTopicId?: string; // Optional message_thread_id for admin approvals topic
  eventsChatId?: string; // Separate events chat for approved events & monthly calendar posts
  eventsTopicId?: string; // Optional message_thread_id for community events topic
  channelChatId?: string; // Legacy fallback/alias
  notifyOnSubmission: boolean;
  notifyOnApproval: boolean;
  notifyOnReschedule: boolean;
  notifyDailyReminders: boolean;
  notifyMonthlyCalendar?: boolean;
  monthlyPostDay?: number; // Day of the month to post (1-28)
  includeCalendarImage?: boolean;
  lastMonthlyPost?: {
    timestamp: string;
    chatId: string;
    topicId?: string;
    success: boolean;
    hasImage: boolean;
    message?: string;
  };
  lastMonthlyPostMonth?: string;
  isConfigured: boolean;
  lastTestStatus?: {
    success: boolean;
    timestamp: string;
    message?: string;
  };
}

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'submission' | 'approval' | 'rejection' | 'reschedule' | 'telegram';
  eventId?: string;
  timestamp: string;
  read: boolean;
}

const TELEGRAM_CONFIG_PATH = path.resolve(process.cwd(), '.telegram-config.json');

function loadPersistedTelegramConfig(): Partial<TelegramConfig> {
  try {
    if (fs.existsSync(TELEGRAM_CONFIG_PATH)) {
      const data = fs.readFileSync(TELEGRAM_CONFIG_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading .telegram-config.json:', e);
  }
  return {};
}

function savePersistedTelegramConfig(config: TelegramConfig) {
  try {
    fs.writeFileSync(TELEGRAM_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    // Also keep .env in sync
    const envPath = path.resolve(process.cwd(), '.env');
    const envLines = [
      `TELEGRAM_BOT_TOKEN=${config.botToken || ''}`,
      `TELEGRAM_ADMIN_CHAT_ID=${config.adminChatId || ''}`,
      `TELEGRAM_ADMIN_TOPIC_ID=${config.adminTopicId || ''}`,
      `TELEGRAM_EVENTS_CHAT_ID=${config.eventsChatId || ''}`,
      `TELEGRAM_EVENTS_TOPIC_ID=${config.eventsTopicId || ''}`,
      ''
    ];
    fs.writeFileSync(envPath, envLines.join('\n'), 'utf-8');
  } catch (e) {
    console.error('Error saving telegram config to disk:', e);
  }
}

const persistedTelegramConfig = loadPersistedTelegramConfig();

let telegramConfig: TelegramConfig = {
  botToken: persistedTelegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN || '',
  adminChatId: persistedTelegramConfig.adminChatId || process.env.TELEGRAM_ADMIN_CHAT_ID || '',
  adminTopicId: persistedTelegramConfig.adminTopicId !== undefined ? persistedTelegramConfig.adminTopicId : (process.env.TELEGRAM_ADMIN_TOPIC_ID || ''),
  eventsChatId: persistedTelegramConfig.eventsChatId || process.env.TELEGRAM_EVENTS_CHAT_ID || process.env.TELEGRAM_CHANNEL_CHAT_ID || '',
  eventsTopicId: persistedTelegramConfig.eventsTopicId !== undefined ? persistedTelegramConfig.eventsTopicId : (process.env.TELEGRAM_EVENTS_TOPIC_ID || ''),
  channelChatId: persistedTelegramConfig.channelChatId || process.env.TELEGRAM_CHANNEL_CHAT_ID || process.env.TELEGRAM_EVENTS_CHAT_ID || '',
  notifyOnSubmission: persistedTelegramConfig.notifyOnSubmission ?? true,
  notifyOnApproval: persistedTelegramConfig.notifyOnApproval ?? true,
  notifyOnReschedule: persistedTelegramConfig.notifyOnReschedule ?? true,
  notifyDailyReminders: persistedTelegramConfig.notifyDailyReminders ?? true,
  notifyMonthlyCalendar: persistedTelegramConfig.notifyMonthlyCalendar ?? true,
  monthlyPostDay: persistedTelegramConfig.monthlyPostDay || 1,
  includeCalendarImage: persistedTelegramConfig.includeCalendarImage ?? true,
  isConfigured: Boolean(
    (persistedTelegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN) &&
    (persistedTelegramConfig.adminChatId || process.env.TELEGRAM_ADMIN_CHAT_ID || persistedTelegramConfig.eventsChatId || process.env.TELEGRAM_EVENTS_CHAT_ID)
  ),
  lastMonthlyPost: persistedTelegramConfig.lastMonthlyPost,
  lastTestStatus: persistedTelegramConfig.lastTestStatus,
};

// Persistent data store with disk persistence & startup backups
createStartupBackup();
let eventsStore: CalendarEvent[] = loadEvents();
let notificationsStore: AdminNotification[] = loadNotifications();

// SSE Clients Registry
const sseClients = new Set<Response>();

function broadcastSSE(type: string, payload: any) {
  const message = JSON.stringify({
    type,
    ...payload,
    timestamp: new Date().toISOString(),
  });

  for (const client of sseClients) {
    try {
      client.write(`data: ${message}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Normalize topic ID.
// In Telegram supergroups, the "General" topic has ID 1 in URL links (e.g. t.me/c/.../1),
// but the Telegram Bot API throws "400 Bad Request: message thread not found" if message_thread_id: 1 is sent.
// For General topic, message_thread_id must be omitted completely.
function normalizeTopicId(topicRaw?: string | number): number | undefined {
  if (topicRaw === undefined || topicRaw === null) return undefined;
  const str = String(topicRaw).trim();
  if (!str) return undefined;
  const num = Number(str);
  if (isNaN(num) || num <= 1) return undefined;
  return num;
}

// Telegram Helper Functions
async function sendTelegramMessage(
  text: string,
  targetChatId?: string,
  targetTopicId?: number | string
): Promise<{ success: boolean; error?: string; messageId?: number; postedToChat?: string; postedToTopic?: string }> {
  const token = telegramConfig.botToken.trim();
  const chatId = targetChatId || telegramConfig.adminChatId.trim();

  if (!token || !chatId) {
    return {
      success: false,
      error: 'Telegram Bot Token or Target Chat ID is not configured.',
    };
  }

  const topicNum = normalizeTopicId(targetTopicId);

  try {
    const bodyPayload: Record<string, any> = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };

    if (topicNum !== undefined) {
      bodyPayload.message_thread_id = topicNum;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });

    let data = await response.json() as any;

    // Automatic resilience fallback: If message failed because message thread was not found, retry without thread ID (delivers to General topic)
    if (!data.ok && bodyPayload.message_thread_id && data.description && /message thread not found/i.test(data.description)) {
      console.warn(`[Telegram] Topic #${topicNum} not found in chat ${chatId}. Retrying sending to General topic...`);
      delete bodyPayload.message_thread_id;
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      data = await response.json() as any;
    }

    if (data && data.ok) {
      return {
        success: true,
        messageId: data.result?.message_id,
        postedToChat: chatId,
        postedToTopic: bodyPayload.message_thread_id ? String(bodyPayload.message_thread_id) : undefined,
      };
    }
    return {
      success: false,
      error: data?.description || 'Telegram API rejected message',
      postedToChat: chatId,
      postedToTopic: bodyPayload.message_thread_id ? String(bodyPayload.message_thread_id) : undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while contacting Telegram API',
      postedToChat: chatId,
    };
  }
}

async function sendTelegramPhoto(
  imageBase64: string,
  caption: string,
  targetChatId?: string,
  targetTopicId?: number | string,
  filename = 'calendar.png'
): Promise<{ success: boolean; error?: string; messageId?: number; postedToChat?: string; postedToTopic?: string }> {
  const token = telegramConfig.botToken.trim();
  const chatId = targetChatId || telegramConfig.eventsChatId?.trim() || telegramConfig.channelChatId?.trim() || telegramConfig.adminChatId.trim();

  if (!token || !chatId) {
    return {
      success: false,
      error: 'Telegram Bot Token or Target Chat ID is not configured.',
    };
  }

  const topicNum = normalizeTopicId(targetTopicId);

  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const blob = new Blob([buffer], { type: 'image/png' });

    // Telegram caption max length is 1024 characters
    const trimmedCaption = caption.length > 1020 ? `${caption.slice(0, 1017)}...` : caption;

    const buildFormData = (includeTopic: boolean) => {
      const fd = new FormData();
      fd.append('chat_id', chatId);
      if (includeTopic && topicNum !== undefined) {
        fd.append('message_thread_id', String(topicNum));
      }
      fd.append('photo', blob, filename);
      if (trimmedCaption) {
        fd.append('caption', trimmedCaption);
        fd.append('parse_mode', 'HTML');
      }
      return fd;
    };

    const url = `https://api.telegram.org/bot${token}/sendPhoto`;
    let response = await fetch(url, {
      method: 'POST',
      body: buildFormData(true),
    });

    let data = await response.json() as any;

    // Retry photo without topic if topic was not found
    if (!data.ok && topicNum !== undefined && data.description && /message thread not found/i.test(data.description)) {
      console.warn(`[Telegram Photo] Topic #${topicNum} not found. Retrying in General topic...`);
      response = await fetch(url, {
        method: 'POST',
        body: buildFormData(false),
      });
      data = await response.json() as any;
    }

    if (data && data.ok) {
      // If caption was truncated, send remainder as text
      if (caption.length > 1020) {
        const overflow = caption.slice(1017);
        await sendTelegramMessage(overflow, chatId, targetTopicId);
      }
      return {
        success: true,
        messageId: data.result?.message_id,
        postedToChat: chatId,
        postedToTopic: topicNum !== undefined ? String(topicNum) : undefined,
      };
    }
    console.warn('sendPhoto failed, falling back to sendMessage:', data?.description);
    const fallback = await sendTelegramMessage(caption, chatId, targetTopicId);
    if (fallback.success) {
      return {
        success: true,
        error: `Image could not be sent (${data?.description}), text message sent instead.`,
        postedToChat: chatId,
        postedToTopic: fallback.postedToTopic,
      };
    }
    return {
      success: false,
      error: data?.description || 'Telegram API rejected photo upload',
      postedToChat: chatId,
      postedToTopic: topicNum !== undefined ? String(topicNum) : undefined,
    };
  } catch (err: any) {
    console.error('Error in sendTelegramPhoto:', err);
    const fallback = await sendTelegramMessage(caption, chatId, targetTopicId);
    if (fallback.success) {
      return {
        success: true,
        error: `Image upload failed (${err?.message}), text message sent instead.`,
        postedToChat: chatId,
        postedToTopic: fallback.postedToTopic,
      };
    }
    return {
      success: false,
      error: err?.message || 'Network error while uploading photo to Telegram',
      postedToChat: chatId,
    };
  }
}

// Destination routing helpers for topic-based Telegram delivery
function getAdminChatAndTopic(overrideChatId?: string, overrideTopicId?: string | number): { chatId: string; topicId?: string } {
  const chatId = overrideChatId?.trim() || telegramConfig.adminChatId?.trim() || '';
  const rawTopic = overrideTopicId !== undefined && overrideTopicId !== null && String(overrideTopicId).trim() !== ''
    ? overrideTopicId
    : telegramConfig.adminTopicId;
  const normalized = normalizeTopicId(rawTopic);
  return { chatId, topicId: normalized ? String(normalized) : undefined };
}

function getEventsChatAndTopic(overrideChatId?: string, overrideTopicId?: string | number): { chatId: string; topicId?: string } {
  // If eventsChatId is not specified, fall back to adminChatId (allows using a single group with multiple topics)
  const chatId = overrideChatId?.trim() || telegramConfig.eventsChatId?.trim() || telegramConfig.channelChatId?.trim() || telegramConfig.adminChatId?.trim() || '';
  const rawTopic = overrideTopicId !== undefined && overrideTopicId !== null && String(overrideTopicId).trim() !== ''
    ? overrideTopicId
    : telegramConfig.eventsTopicId;
  const normalized = normalizeTopicId(rawTopic);
  return { chatId, topicId: normalized ? String(normalized) : undefined };
}

const SESSION_COOKIE_NAME = 'cal_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'sakk-calendar-auth-secret-key-default-2026';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
let googleOAuthClient: OAuth2Client | null = null;
if (GOOGLE_CLIENT_ID) {
  try {
    googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  } catch (err) {
    console.warn('Failed to initialize OAuth2Client:', err);
  }
}

function getAdminEmails(): string[] {
  const envVal = process.env.ADMIN_EMAILS || '';
  return envVal
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email: string): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const list = getAdminEmails();
  return list.includes(normalized);
}

function createSessionToken(user: AuthUser, expiresInMs = 14 * 24 * 60 * 60 * 1000): string {
  const payload = {
    ...user,
    exp: Date.now() + expiresInMs,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifySessionToken(token: string): AuthUser | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;

    // Dynamically evaluate role based on current ADMIN_EMAILS
    const configuredAdmins = getAdminEmails();
    let isRoleAdmin = false;
    if (configuredAdmins.length > 0) {
      isRoleAdmin = isAdminEmail(payload.email);
    } else {
      isRoleAdmin = payload.role === 'admin';
    }

    return {
      email: payload.email,
      name: payload.name || payload.email,
      picture: payload.picture,
      role: isRoleAdmin ? 'admin' : 'user',
    };
  } catch {
    return null;
  }
}

function getAuthUser(req: Request): AuthUser | null {
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (cookieToken) {
    const user = verifySessionToken(cookieToken);
    if (user) return user;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const headerToken = authHeader.slice(7).trim();
    const user = verifySessionToken(headerToken);
    if (user) return user;
  }
  return null;
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden: Administrator privileges required',
      code: 'ADMIN_REQUIRED',
    });
  }
  (req as any).user = user;
  next();
}

async function verifyGoogleCredential(credential: string): Promise<{ email: string; name: string; picture?: string } | null> {
  const currentClientId = process.env.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;
  if (currentClientId) {
    try {
      const client = googleOAuthClient || new OAuth2Client(currentClientId);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: currentClientId,
      });
      const payload = ticket.getPayload();
      if (payload && payload.email && (payload.email_verified || payload.email_verified === undefined)) {
        return {
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          picture: payload.picture,
        };
      }
    } catch (err) {
      console.warn('OAuth2Client token verification fallback to tokeninfo endpoint:', err);
    }
  }

  try {
    const fetchRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (fetchRes.ok) {
      const data: any = await fetchRes.json();
      if (data.email && (data.email_verified === 'true' || data.email_verified === true || data.email_verified === undefined)) {
        if (currentClientId && data.aud && data.aud !== currentClientId) {
          console.warn('Token audience mismatch:', data.aud, 'expected:', currentClientId);
          return null;
        }
        return {
          email: data.email,
          name: data.name || data.email.split('@')[0],
          picture: data.picture,
        };
      }
    }
  } catch (err) {
    console.error('Failed to verify token with Google tokeninfo endpoint:', err);
  }

  return null;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      eventsCount: eventsStore.length,
      pendingCount: eventsStore.filter(e => e.status === 'pending').length,
      sseConnectedClients: sseClients.size,
      telegramConfigured: telegramConfig.isConfigured,
    });
  });

  // Real-time Server-Sent Events stream
  app.get('/api/events/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);

    // Send initial snapshot
    const initialData = JSON.stringify({
      type: 'INIT',
      events: eventsStore,
      notifications: notificationsStore,
      telegramConfig: {
        ...telegramConfig,
        botToken: telegramConfig.botToken ? `${telegramConfig.botToken.slice(0, 5)}...` : '',
      },
      timestamp: new Date().toISOString(),
    });
    res.write(`data: ${initialData}\n\n`);

    // Heartbeat ping every 25 seconds
    const intervalId = setInterval(() => {
      res.write(': ping\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(intervalId);
      sseClients.delete(res);
    });
  });

  // Authentication Endpoints
  app.get('/api/auth/config', (_req: Request, res: Response) => {
    const adminEmails = getAdminEmails();
    res.json({
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',
      hasGoogleAuth: Boolean(process.env.GOOGLE_CLIENT_ID),
      adminConfigured: adminEmails.length > 0,
      adminEmailsCount: adminEmails.length,
    });
  });

  app.get('/api/auth/me', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    res.json({ user });
  });

  app.post('/api/auth/google', async (req: Request, res: Response) => {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({ error: 'Missing Google credential ID token' });
      }

      const profile = await verifyGoogleCredential(credential);
      if (!profile) {
        return res.status(401).json({ error: 'Invalid or expired Google credential' });
      }

      const adminEmails = getAdminEmails();
      const isAdmin = adminEmails.length > 0 ? isAdminEmail(profile.email) : false;

      const authUser: AuthUser = {
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        role: isAdmin ? 'admin' : 'user',
      };

      const token = createSessionToken(authUser);
      const isHttps = req.secure || process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
      res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: Boolean(isHttps),
        sameSite: 'lax',
        maxAge: 14 * 24 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        user: authUser,
        token,
      });
    } catch (err: any) {
      console.error('Auth error in POST /api/auth/google:', err);
      return res.status(500).json({ error: err.message || 'Authentication failed' });
    }
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
    });
    return res.json({ success: true });
  });

  app.post('/api/auth/dev-login', (req: Request, res: Response) => {
    try {
      const { role = 'admin', email = 'admin@example.com', name = 'Administrator' } = req.body;
      const targetRole: 'admin' | 'user' = role === 'admin' ? 'admin' : 'user';

      const authUser: AuthUser = {
        email: String(email).trim().toLowerCase(),
        name: String(name).trim() || 'Admin User',
        role: targetRole,
      };

      const token = createSessionToken(authUser);
      const isHttps = req.secure || process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
      res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: Boolean(isHttps),
        sameSite: 'lax',
        maxAge: 14 * 24 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        user: authUser,
        token,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Dev login failed' });
    }
  });

  // Get all events (filtered by role)
  app.get('/api/events', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const isAdmin = user?.role === 'admin';

    if (isAdmin) {
      res.json({
        events: eventsStore,
        notifications: notificationsStore,
      });
    } else {
      res.json({
        events: eventsStore.filter((e) => e.status === 'approved'),
        notifications: [],
      });
    }
  });

  // Google Forms Webhook endpoint
  // Matches submissions from Google Apps Script onFormSubmit trigger
  app.post('/api/webhooks/google-form', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};

      // Flexible extraction supporting both mapped payloads and raw Apps Script arrays
      const title =
        body.title ||
        body['Event Title'] ||
        body['Title'] ||
        body['event_title'] ||
        body['name'] ||
        'Untitled Form Event';

      let category = (
        body.category ||
        body['Event Category'] ||
        body['Category'] ||
        body['category_name'] ||
        'other'
      ).trim();

      // Normalize category to one of the 6 allowed EventCategories
      const catLower = category.toLowerCase();
      if (category === 'SAKK meeting' || (catLower.includes('sakk') && (catLower.includes('meet') || catLower.includes('sync')))) {
        category = 'SAKK meeting';
      } else if (category === 'SAKK Event' || catLower.includes('sakk')) {
        category = 'SAKK Event';
      } else if (category === 'Member EVent (21+)' || category === 'Member Event (21+)' || catLower.includes('21+') || catLower.includes('21 +')) {
        category = 'Member EVent (21+)';
      } else if (category === 'Member Event (18+)' || catLower.includes('18+') || catLower.includes('18 +')) {
        category = 'Member Event (18+)';
      } else if (category === 'celebration' || catLower.includes('celeb') || catLower.includes('party') || catLower.includes('gala') || catLower.includes('anniversary')) {
        category = 'celebration';
      } else {
        category = 'other';
      }

      const date =
        body.date ||
        body['Date'] ||
        body['Event Date'] ||
        body['Start Date'] ||
        body['event_date'] ||
        new Date().toISOString().split('T')[0];

      const rawEndDate =
        body.endDate ||
        body['End Date'] ||
        body['end_date'] ||
        body['Until Date'] ||
        undefined;

      let endDate: string | undefined = undefined;
      let isMultiDay = false;
      if (rawEndDate && typeof rawEndDate === 'string') {
        const trimmedEnd = rawEndDate.trim();
        if (trimmedEnd && trimmedEnd >= date) {
          endDate = trimmedEnd;
          isMultiDay = endDate > date;
        }
      }

      const startTime = body.startTime || body['Start Time'] || body['start_time'] || '10:00';
      const endTime = body.endTime || body['End Time'] || body['end_time'] || '11:00';

      const submitterName = (
        body.submitterName ||
        body['Preferred Name'] ||
        body['preferred_name'] ||
        body['Submitter Name'] ||
        body['Your Name'] ||
        body['Name'] ||
        'Anonymous Submitter'
      ).trim();

      let rawEmail = (
        body.submitterEmail ||
        body['Telegram Handle'] ||
        body['telegram_handle'] ||
        body['Telegram'] ||
        body['Submitter Email'] ||
        body['Your Email'] ||
        body['Email'] ||
        body['Email Address'] ||
        '@member'
      ).trim();

      const submitterEmail = rawEmail.startsWith('@') || rawEmail.includes('@')
        ? rawEmail
        : `@${rawEmail}`;

      const location = (
        body.location ||
        body['Location'] ||
        body['Location / Meet Link'] ||
        body['Location or Virtual Meeting Link'] ||
        body['Venue'] ||
        'Online / TBD'
      ).trim();

      const description = (
        body.description ||
        body['Description'] ||
        body['Event Description'] ||
        body['Details'] ||
        'No additional description provided.'
      ).trim();

      const expectedAttendees =
        body.expectedAttendees ||
        body['Expected Attendees'] ||
        body['Estimated Attendees'] ||
        body['Attendees'];

      const equipmentNeeds =
        body.equipmentNeeds ||
        body['Equipment Needs'] ||
        body['Special Equipment'] ||
        body['Equipment'];

      // Duplicate submission guard (e.g. form resubmit or double webhook call)
      const isDuplicate = eventsStore.some((e) => {
        const isSameTitle = e.title.trim().toLowerCase() === title.trim().toLowerCase();
        const isSameDate = e.date === date;
        const isSameTime = e.startTime === startTime;
        const isSameSubmitter = e.submitterEmail?.trim().toLowerCase() === submitterEmail.trim().toLowerCase();
        if (isSameTitle && isSameDate && isSameTime && isSameSubmitter) {
          const timeDiff = Math.abs(Date.now() - new Date(e.submittedAt).getTime());
          if (timeDiff < 120000 || e.status === 'pending') {
            return true;
          }
        }
        return false;
      });

      if (isDuplicate) {
        console.warn(`[Duplicate Guard] Ignored duplicate Google Form submission: "${title}" on ${date}`);
        const existingEvent = eventsStore.find((e) =>
          e.title.trim().toLowerCase() === title.trim().toLowerCase() &&
          e.date === date
        );
        return res.status(200).json({
          success: true,
          message: 'Duplicate submission received; existing pending request retained.',
          event: existingEvent,
          isDuplicate: true,
        });
      }

      const newEvent: CalendarEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title,
        category,
        date,
        endDate: isMultiDay ? endDate : undefined,
        isMultiDay,
        startTime,
        endTime,
        status: 'pending', // Requires administrator approval
        submitterName,
        submitterEmail,
        location,
        description,
        expectedAttendees,
        equipmentNeeds,
        submittedAt: new Date().toISOString(),
        source: 'google_form',
        rawFormAnswers: typeof body === 'object' ? { ...body } : undefined,
      };

      eventsStore.push(newEvent);

      // Create Admin Notification
      const newNotif: AdminNotification = {
        id: `notif-${Date.now()}`,
        title: 'New Google Form Submission',
        message: `${submitterName} submitted "${title}" awaiting approval.`,
        type: 'submission',
        eventId: newEvent.id,
        timestamp: newEvent.submittedAt,
        read: false,
      };
      notificationsStore.unshift(newNotif);
      saveEvents(eventsStore);
      saveNotifications(notificationsStore);

      // Automated Real-Time Broadcast to all dashboards
      broadcastSSE('EVENT_SUBMITTED', {
        event: newEvent,
        notification: newNotif,
        message: `New event "${title}" submitted via Google Form awaiting administrator approval.`,
      });

      // Send Automated Telegram Notification to Administrator
      let telegramResult: { success: boolean; error?: string } = { success: false };
      if (telegramConfig.isConfigured && telegramConfig.notifyOnSubmission) {
        const dateRangeDisplay = formatEventDateRange(date, endDate);
        const tgMessage =
          `🔔 <b>New Google Form Event Submission</b>\n\n` +
          `📌 <b>Title:</b> ${title}\n` +
          `🏷️ <b>Category:</b> ${category.toUpperCase()}\n` +
          `📅 <b>Date${isMultiDay ? 's' : ''}:</b> ${dateRangeDisplay} (${startTime} - ${endTime})\n` +
          `📍 <b>Location:</b> ${location}\n` +
          `👤 <b>Submitter:</b> ${submitterName} (${submitterEmail})\n\n` +
          `📝 <b>Description:</b>\n${description.slice(0, 300)}\n\n` +
          `⚠️ <i>Status: Awaiting Administrator Approval in Dashboard</i>`;

        const adminDest = getAdminChatAndTopic();
        telegramResult = await sendTelegramMessage(
          tgMessage,
          adminDest.chatId,
          adminDest.topicId
        );
        if (telegramResult.success) {
          newEvent.telegramNotified = true;
          newEvent.telegramDestination = {
            chatId: adminDest.chatId,
            topicId: adminDest.topicId,
            type: 'submission',
            timestamp: new Date().toISOString(),
          };
          saveEvents(eventsStore);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Google Form submission received and queued for admin approval.',
        event: newEvent,
        telegramNotified: telegramResult.success,
      });
    } catch (err: any) {
      console.error('Error processing google form webhook:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Manual event submission endpoint
  app.post('/api/events', async (req: Request, res: Response) => {
    try {
      const {
        title,
        category = 'SAKK Event',
        date,
        endDate: rawEndDate,
        isMultiDay: rawIsMultiDay,
        startTime = '09:00',
        endTime = '10:00',
        submitterName,
        submitterEmail,
        location,
        description,
        expectedAttendees = '',
        equipmentNeeds = '',
      } = req.body;

      const trimmedTitle = typeof title === 'string' ? title.trim() : '';
      const trimmedDate = typeof date === 'string' ? date.trim() : '';
      const trimmedName = typeof submitterName === 'string' ? submitterName.trim() : '';
      let trimmedHandle = typeof submitterEmail === 'string' ? submitterEmail.trim() : '';
      const trimmedLocation = typeof location === 'string' ? location.trim() : '';
      const trimmedDescription = typeof description === 'string' ? description.trim() : '';

      let endDate: string | undefined = undefined;
      let isMultiDay = false;
      if (rawEndDate && typeof rawEndDate === 'string') {
        const trimmedEnd = rawEndDate.trim();
        if (trimmedEnd) {
          if (trimmedEnd < trimmedDate) {
            return res.status(400).json({
              error: 'End date cannot be earlier than the start date.',
            });
          }
          endDate = trimmedEnd;
          isMultiDay = endDate > trimmedDate;
        }
      } else if (rawIsMultiDay) {
        isMultiDay = Boolean(rawIsMultiDay);
      }

      const isCelebration = category === 'celebration';

      if (isCelebration) {
        if (!trimmedTitle || !trimmedDate) {
          return res.status(400).json({
            error: 'Title, Category, and Date are required for a celebration event.',
          });
        }
      } else {
        if (!trimmedTitle || !trimmedDate || !trimmedName || !trimmedHandle || !trimmedLocation || !trimmedDescription) {
          return res.status(400).json({
            error: 'Title, Date, Preferred Name, Telegram Handle, Location, and Description are required fields.',
          });
        }
      }

      if (trimmedHandle && !trimmedHandle.startsWith('@') && !trimmedHandle.includes('@')) {
        trimmedHandle = `@${trimmedHandle}`;
      }

      // Duplicate submission guard (e.g. double-click submit or network retry)
      const isDuplicate = eventsStore.some((e) => {
        const isSameTitle = e.title.trim().toLowerCase() === trimmedTitle.toLowerCase();
        const isSameDate = e.date === trimmedDate;
        const isSameSubmitter = e.submitterEmail?.trim().toLowerCase() === trimmedHandle.toLowerCase();
        if (isSameTitle && isSameDate && isSameSubmitter) {
          const timeDiff = Math.abs(Date.now() - new Date(e.submittedAt).getTime());
          if (timeDiff < 120000 || e.status === 'pending') {
            return true;
          }
        }
        return false;
      });

      if (isDuplicate) {
        console.warn(`[Duplicate Guard] Ignored duplicate manual submission: "${trimmedTitle}" on ${trimmedDate}`);
        const existingEvent = eventsStore.find((e) =>
          e.title.trim().toLowerCase() === trimmedTitle.toLowerCase() &&
          e.date === trimmedDate
        );
        return res.status(200).json({
          success: true,
          message: 'Duplicate submission received; existing request retained.',
          event: existingEvent,
          isDuplicate: true,
        });
      }

      const rawRecurrence = req.body.recurrenceRule;
      const isRecurringRequest =
        rawRecurrence &&
        rawRecurrence.frequency &&
        rawRecurrence.frequency !== 'none';

      if (isRecurringRequest) {
        const recurrenceRule: RecurrenceRule = {
          ...rawRecurrence,
          humanReadable: formatRecurrenceLabel(rawRecurrence),
        };

        const recurringDates = calculateRecurringDates(trimmedDate, recurrenceRule);
        const recurringSeriesId = `series-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const effectiveStartTime = typeof startTime === 'string' ? startTime.trim() : (isCelebration ? '' : '09:00');
        const effectiveEndTime = typeof endTime === 'string' ? endTime.trim() : (isCelebration ? '' : '10:00');

        const createdSeries: CalendarEvent[] = recurringDates.map((dateStr, idx) => ({
          id: idx === 0
            ? `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
            : `evt-${Date.now()}-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
          title: trimmedTitle,
          category,
          date: dateStr,
          startTime: effectiveStartTime,
          endTime: effectiveEndTime,
          status: 'pending',
          submitterName: trimmedName || (isCelebration ? 'Celebration Announcement' : 'Community Member'),
          submitterEmail: trimmedHandle || (isCelebration ? '@community' : '@member'),
          location: trimmedLocation || (isCelebration ? 'Celebration / Community' : 'Online / TBD'),
          description: trimmedDescription || (isCelebration ? 'Celebration / Anniversary Announcement' : ''),
          expectedAttendees: typeof expectedAttendees === 'string' ? expectedAttendees.trim() : '',
          equipmentNeeds: typeof equipmentNeeds === 'string' ? equipmentNeeds.trim() : '',
          submittedAt: new Date().toISOString(),
          source: 'direct_submission',
          isRecurring: true,
          recurringSeriesId,
          recurrenceRule,
          recurrenceIndex: idx + 1,
          recurrenceTotal: recurringDates.length,
        }));

        for (const evt of createdSeries) {
          eventsStore.push(evt);
        }

        const firstEvent = createdSeries[0];
        const notif: AdminNotification = {
          id: `notif-${Date.now()}`,
          title: isCelebration ? 'New Recurring Celebration Request' : 'New Recurring Event Request',
          message: `${firstEvent.submitterName} requested recurring "${firstEvent.title}" (${recurrenceRule.humanReadable}, ${createdSeries.length} events).`,
          type: 'submission',
          eventId: firstEvent.id,
          timestamp: firstEvent.submittedAt,
          read: false,
        };
        notificationsStore.unshift(notif);
        saveEvents(eventsStore);
        saveNotifications(notificationsStore);

        broadcastSSE('EVENT_SUBMITTED', {
          event: firstEvent,
          events: createdSeries,
          notification: notif,
        });

        if (telegramConfig.isConfigured && telegramConfig.notifyOnSubmission) {
          const timeDisplay = (firstEvent.startTime && firstEvent.endTime)
            ? `${firstEvent.startTime} to ${firstEvent.endTime}`
            : (firstEvent.startTime ? `at ${firstEvent.startTime}` : 'All Day / Untimed');
          const tgMsg =
            `🔔 <b>New Recurring ${isCelebration ? 'Celebration' : 'Event'} Request Submitted</b>\n\n` +
            `📌 <b>${firstEvent.title}</b>\n` +
            `🔁 <b>Schedule:</b> ${recurrenceRule.humanReadable}\n` +
            `📅 <b>First Date:</b> ${firstEvent.date} (${timeDisplay})\n` +
            `🔢 <b>Occurrences:</b> ${createdSeries.length} events\n` +
            `👤 ${firstEvent.submitterName} (${firstEvent.submitterEmail})\n` +
            `📍 ${firstEvent.location}\n\n` +
            `Action required: Approve or reject series in admin dashboard.`;
          const adminDest = getAdminChatAndTopic();
          const tgResult = await sendTelegramMessage(tgMsg, adminDest.chatId, adminDest.topicId);
          if (tgResult.success) {
            firstEvent.telegramNotified = true;
            firstEvent.telegramDestination = {
              chatId: adminDest.chatId,
              topicId: adminDest.topicId,
              type: 'submission',
              timestamp: new Date().toISOString(),
            };
            for (const s of createdSeries) {
              s.telegramNotified = true;
              s.telegramDestination = firstEvent.telegramDestination;
            }
            saveEvents(eventsStore);
          }
        }

        return res.status(201).json({
          success: true,
          event: firstEvent,
          series: createdSeries,
          totalCreated: createdSeries.length,
        });
      }

      const newEvent: CalendarEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: trimmedTitle,
        category,
        date: trimmedDate,
        endDate: isMultiDay ? endDate : undefined,
        isMultiDay,
        startTime: typeof startTime === 'string' ? startTime.trim() : (isCelebration ? '' : '09:00'),
        endTime: typeof endTime === 'string' ? endTime.trim() : (isCelebration ? '' : '10:00'),
        status: 'pending',
        submitterName: trimmedName || (isCelebration ? 'Celebration Announcement' : 'Community Member'),
        submitterEmail: trimmedHandle || (isCelebration ? '@community' : '@member'),
        location: trimmedLocation || (isCelebration ? 'Celebration / Community' : 'Online / TBD'),
        description: trimmedDescription || (isCelebration ? 'Celebration / Anniversary Announcement' : ''),
        expectedAttendees: typeof expectedAttendees === 'string' ? expectedAttendees.trim() : '',
        equipmentNeeds: typeof equipmentNeeds === 'string' ? equipmentNeeds.trim() : '',
        submittedAt: new Date().toISOString(),
        source: 'direct_submission',
      };

      eventsStore.push(newEvent);

      const notif: AdminNotification = {
        id: `notif-${Date.now()}`,
        title: isCelebration ? 'New Celebration Request' : 'New Event Request',
        message: `${newEvent.submitterName} requested "${newEvent.title}".`,
        type: 'submission',
        eventId: newEvent.id,
        timestamp: newEvent.submittedAt,
        read: false,
      };
      notificationsStore.unshift(notif);
      saveEvents(eventsStore);
      saveNotifications(notificationsStore);

      broadcastSSE('EVENT_SUBMITTED', {
        event: newEvent,
        notification: notif,
      });

      if (telegramConfig.isConfigured && telegramConfig.notifyOnSubmission) {
        const dateRangeDisplay = formatEventDateRange(newEvent.date, newEvent.endDate);
        const timeDisplay = (newEvent.startTime && newEvent.endTime)
          ? `${newEvent.startTime} to ${newEvent.endTime}`
          : (newEvent.startTime ? `at ${newEvent.startTime}` : 'All Day / Untimed');
        const tgMsg =
          `🔔 <b>New ${isCelebration ? 'Celebration' : 'Event'} Request Submitted</b>\n\n` +
          `📌 <b>${newEvent.title}</b>\n` +
          `📅 <b>Date${newEvent.isMultiDay ? 's' : ''}:</b> ${dateRangeDisplay} (${timeDisplay})\n` +
          `👤 ${newEvent.submitterName} (${newEvent.submitterEmail})\n` +
          `📍 ${newEvent.location}\n\n` +
          `Action required: Approve or reject in admin dashboard.`;
        const adminDest = getAdminChatAndTopic();
        const tgResult = await sendTelegramMessage(tgMsg, adminDest.chatId, adminDest.topicId);
        if (tgResult.success) {
          newEvent.telegramNotified = true;
          newEvent.telegramDestination = {
            chatId: adminDest.chatId,
            topicId: adminDest.topicId,
            type: 'submission',
            timestamp: new Date().toISOString(),
          };
          saveEvents(eventsStore);
        }
      }

      res.status(201).json({ success: true, event: newEvent });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Approve Event
  app.post('/api/events/:id/approve', requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const event = eventsStore.find(e => e.id === id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const applyToSeries = req.body.applyToSeries !== false;
    const seriesEvents = (event.recurringSeriesId && applyToSeries)
      ? eventsStore.filter(e => e.recurringSeriesId === event.recurringSeriesId)
      : [event];

    const approvedAt = new Date().toISOString();
    const approvedBy = req.body.approvedBy || (req as any).user?.name || 'Administrator';

    if (req.body.updates && typeof req.body.updates === 'object') {
      const {
        title,
        category,
        date,
        endDate,
        isMultiDay,
        startTime,
        endTime,
        location,
        description,
        expectedAttendees,
        equipmentNeeds,
        submitterName,
        submitterEmail,
        notes,
      } = req.body.updates;

      for (const target of seriesEvents) {
        if (title !== undefined) target.title = String(title).trim();
        if (category !== undefined) target.category = category;
        if (target.id === id) {
          if (date !== undefined) target.date = date;
          if (endDate !== undefined) target.endDate = endDate;
          if (isMultiDay !== undefined) target.isMultiDay = isMultiDay;
        }
        if (startTime !== undefined) target.startTime = startTime;
        if (endTime !== undefined) target.endTime = endTime;
        if (location !== undefined) target.location = String(location).trim();
        if (description !== undefined) target.description = String(description).trim();
        if (expectedAttendees !== undefined) target.expectedAttendees = expectedAttendees;
        if (equipmentNeeds !== undefined) target.equipmentNeeds = equipmentNeeds;
        if (submitterName !== undefined) target.submitterName = String(submitterName).trim();
        if (submitterEmail !== undefined) target.submitterEmail = String(submitterEmail).trim();
        if (notes !== undefined) target.notes = String(notes).trim();
      }
    }

    for (const target of seriesEvents) {
      target.status = 'approved';
      target.approvedAt = approvedAt;
      target.approvedBy = approvedBy;
    }

    const notif: AdminNotification = {
      id: `notif-${Date.now()}`,
      title: 'Event Approved',
      message: `"${event.title}" was approved by ${approvedBy}.`,
      type: 'approval',
      eventId: event.id,
      timestamp: approvedAt,
      read: false,
    };
    notificationsStore.unshift(notif);
    saveEvents(eventsStore);
    saveNotifications(notificationsStore);

    broadcastSSE('EVENT_APPROVED', {
      event,
      events: seriesEvents,
      notification: notif,
    });

    let telegramDispatched = false;
    let targetChatUsed = '';
    if (telegramConfig.notifyOnApproval) {
      const resolved = getEventsChatAndTopic();
      targetChatUsed = resolved.chatId;
      if (targetChatUsed) {
        const timeStr = event.startTime
          ? `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ''}`
          : (event.category === 'celebration' ? 'All Day Celebration' : 'All Day / Untimed');
        const recurrenceInfo = event.isRecurring && event.recurrenceRule?.humanReadable
          ? `\n🔁 <b>Series:</b> ${event.recurrenceRule.humanReadable}`
          : '';
        const dateRangeDisplay = formatEventDateRange(event.date, event.endDate);

        const tgMsg =
          `✅ <b>NEW EVENT APPROVED</b>\n\n` +
          `📌 <b>${event.title}</b>\n` +
          `📅 <b>Date${event.isMultiDay ? 's' : ''}:</b> ${dateRangeDisplay}\n` +
          `⏰ <b>Time:</b> ${timeStr}\n` +
          `🏷️ <b>Category:</b> ${event.category.toUpperCase()}\n` +
          `📍 <b>Location:</b> ${event.location || 'Community Venue / Virtual'}\n` +
          `👤 <b>Organizer:</b> ${event.submitterName}\n` +
          (event.expectedAttendees ? `👥 <b>Expected Attendees:</b> ${event.expectedAttendees}\n` : '') +
          (event.equipmentNeeds ? `🛠️ <b>Equipment/Notes:</b> ${event.equipmentNeeds}\n` : '') +
          recurrenceInfo +
          `\n📝 <b>Description:</b>\n${event.description || 'No description provided.'}\n\n` +
          `🔗 <i>This event is now live on the public community calendar!</i>`;

        const sent = await sendTelegramMessage(tgMsg, targetChatUsed, resolved.topicId);
        telegramDispatched = sent.success;
        if (sent.success) {
          event.telegramNotified = true;
          event.telegramDestination = {
            chatId: targetChatUsed,
            topicId: resolved.topicId,
            type: 'approval',
            timestamp: new Date().toISOString(),
          };
          saveEvents(eventsStore);
        }
      }
    }

    res.json({
      success: true,
      event,
      approvedCount: seriesEvents.length,
      telegramDispatched,
      targetChat: targetChatUsed,
      targetTopic: telegramConfig.eventsTopicId || '',
    });
  });

  // Admin Reject Event
  app.post('/api/events/:id/reject', requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason = 'Scheduling conflict or incomplete requirements', applyToSeries = true } = req.body;
    const event = eventsStore.find(e => e.id === id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const seriesEvents = (event.recurringSeriesId && applyToSeries)
      ? eventsStore.filter(e => e.recurringSeriesId === event.recurringSeriesId)
      : [event];

    for (const target of seriesEvents) {
      target.status = 'rejected';
      target.rejectionReason = reason;
    }

    const notif: AdminNotification = {
      id: `notif-${Date.now()}`,
      title: 'Event Rejected',
      message: `"${event.title}" was declined. Reason: ${reason}`,
      type: 'rejection',
      eventId: event.id,
      timestamp: new Date().toISOString(),
      read: false,
    };
    notificationsStore.unshift(notif);
    saveEvents(eventsStore);
    saveNotifications(notificationsStore);

    broadcastSSE('EVENT_REJECTED', {
      event,
      events: seriesEvents,
      notification: notif,
    });

    res.json({ success: true, event, rejectedCount: seriesEvents.length });
  });

  // Update or Reschedule Event
  app.patch('/api/events/:id', requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const eventIndex = eventsStore.findIndex(e => e.id === id);

    if (eventIndex === -1) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const targetEvent = eventsStore[eventIndex];
    const previous = { ...targetEvent };
    const scope = req.query.scope || req.body.scope || 'single';
    const applyToSeries = scope === 'series' && Boolean(targetEvent.recurringSeriesId);

    if (applyToSeries) {
      const seriesId = targetEvent.recurringSeriesId!;
      const seriesEvents = eventsStore.filter(e => e.recurringSeriesId === seriesId);

      const { title, category, location, description, startTime, endTime, submitterName, submitterEmail, expectedAttendees, equipmentNeeds, notes } = req.body;

      for (const sEvt of seriesEvents) {
        if (title !== undefined && String(title).trim()) sEvt.title = String(title).trim();
        if (category !== undefined) sEvt.category = category;
        if (location !== undefined) sEvt.location = String(location).trim();
        if (description !== undefined) sEvt.description = String(description).trim();
        if (startTime !== undefined) sEvt.startTime = String(startTime).trim();
        if (endTime !== undefined) sEvt.endTime = String(endTime).trim();
        if (submitterName !== undefined) sEvt.submitterName = String(submitterName).trim();
        if (submitterEmail !== undefined) sEvt.submitterEmail = String(submitterEmail).trim();
        if (expectedAttendees !== undefined) sEvt.expectedAttendees = String(expectedAttendees).trim();
        if (equipmentNeeds !== undefined) sEvt.equipmentNeeds = String(equipmentNeeds).trim();
        if (notes !== undefined) sEvt.notes = String(notes).trim();
      }

      if (req.body.date !== undefined && String(req.body.date).trim()) {
        targetEvent.date = String(req.body.date).trim();
      }

      const notif: AdminNotification = {
        id: `notif-${Date.now()}`,
        title: 'Recurring Series Updated',
        message: `All ${seriesEvents.length} events in series "${targetEvent.title}" were updated.`,
        type: 'reschedule',
        eventId: targetEvent.id,
        timestamp: new Date().toISOString(),
        read: false,
      };
      notificationsStore.unshift(notif);
      saveEvents(eventsStore);
      saveNotifications(notificationsStore);

      broadcastSSE('EVENT_UPDATED', {
        event: targetEvent,
        seriesEvents,
        notification: notif,
      });

      return res.json({ success: true, event: targetEvent, updatedCount: seriesEvents.length });
    }

    const updated = { ...previous, ...req.body };
    if (req.body.endDate !== undefined) {
      const trimmedEnd = String(req.body.endDate).trim();
      updated.endDate = trimmedEnd || undefined;
      updated.isMultiDay = Boolean(updated.endDate && updated.endDate > updated.date);
    } else if (req.body.isMultiDay !== undefined && !updated.endDate) {
      updated.isMultiDay = Boolean(req.body.isMultiDay);
    }
    if (updated.endDate && updated.endDate < updated.date) {
      return res.status(400).json({ error: 'End date cannot be earlier than start date.' });
    }

    const dateChanged =
      previous.date !== updated.date ||
      previous.endDate !== updated.endDate ||
      previous.startTime !== updated.startTime;
    eventsStore[eventIndex] = updated;

    const notif: AdminNotification = {
      id: `notif-${Date.now()}`,
      title: dateChanged ? 'Important Scheduling Change' : 'Event Updated',
      message: dateChanged
        ? `"${updated.title}" rescheduled from ${formatEventDateRange(previous.date, previous.endDate)} to ${formatEventDateRange(updated.date, updated.endDate)}.`
        : `"${updated.title}" event details updated.`,
      type: 'reschedule',
      eventId: updated.id,
      timestamp: new Date().toISOString(),
      read: false,
    };
    notificationsStore.unshift(notif);
    saveEvents(eventsStore);
    saveNotifications(notificationsStore);

    broadcastSSE('EVENT_UPDATED', {
      event: updated,
      notification: notif,
      dateChanged,
    });

    // Notify via Telegram if scheduling changed
    if (dateChanged && telegramConfig.isConfigured && telegramConfig.notifyOnReschedule) {
      const { chatId: targetChat, topicId: targetTopic } = getEventsChatAndTopic();
      const oldRange = formatEventDateRange(previous.date, previous.endDate);
      const newRange = formatEventDateRange(updated.date, updated.endDate);
      const oldTime = (previous.startTime && previous.endTime)
        ? `${previous.startTime} – ${previous.endTime}`
        : (previous.startTime || 'Untimed');
      const newTime = (updated.startTime && updated.endTime)
        ? `${updated.startTime} – ${updated.endTime}`
        : (updated.startTime || 'Untimed');
      const tgMsg =
        `⚠️ <b>Important Scheduling Change Alert</b>\n\n` +
        `📌 <b>${updated.title}</b> has been rescheduled!\n\n` +
        `⏮️ <b>Old Schedule:</b> ${oldRange} (${oldTime})\n` +
        `⏭️ <b>New Schedule:</b> ${newRange} (${newTime})\n` +
        `📍 <b>Location:</b> ${updated.location}\n\n` +
        `Please update your calendars accordingly.`;
      await sendTelegramMessage(tgMsg, targetChat, targetTopic);
    }

    res.json({ success: true, event: updated });
  });

  // Delete Event
  app.delete('/api/events/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const decodedId = decodeURIComponent(id);
    const eventIndex = eventsStore.findIndex(e => e.id === id || e.id === decodedId);

    if (eventIndex === -1) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const targetEvent = eventsStore[eventIndex];
    const scope = (req.query.scope as string) || req.body?.scope || 'single';

    if (scope === 'series' && targetEvent.recurringSeriesId) {
      const seriesId = targetEvent.recurringSeriesId;
      const initialCount = eventsStore.length;
      eventsStore = eventsStore.filter(e => e.recurringSeriesId !== seriesId);
      const deletedCount = initialCount - eventsStore.length;

      const notif: AdminNotification = {
        id: `notif-${Date.now()}`,
        title: 'Event Series Deleted',
        message: `Deleted all ${deletedCount} events in recurring series "${targetEvent.title}".`,
        type: 'rejection',
        timestamp: new Date().toISOString(),
        read: false,
      };
      notificationsStore.unshift(notif);
      saveEvents(eventsStore);
      saveNotifications(notificationsStore);

      broadcastSSE('EVENT_DELETED', {
        eventId: targetEvent.id,
        seriesId,
        deletedCount,
        notification: notif,
        message: `Deleted all ${deletedCount} events in recurring series "${targetEvent.title}".`,
      });

      return res.json({ success: true, eventId: targetEvent.id, deletedCount, seriesId });
    }

    const removed = eventsStore.splice(eventIndex, 1)[0];

    const notif: AdminNotification = {
      id: `notif-${Date.now()}`,
      title: 'Event Deleted',
      message: `Event "${removed.title}" was deleted.`,
      type: 'rejection',
      timestamp: new Date().toISOString(),
      read: false,
    };
    notificationsStore.unshift(notif);
    saveEvents(eventsStore);
    saveNotifications(notificationsStore);

    broadcastSSE('EVENT_DELETED', {
      eventId: removed.id,
      notification: notif,
      message: `Event "${removed.title}" was deleted.`,
    });

    res.json({ success: true, eventId: removed.id, deletedCount: 1 });
  });


  // Download Event as iCal (.ics)
  app.get('/api/events/:id/ics', (req: Request, res: Response) => {
    const { id } = req.params;
    const event = eventsStore.find(e => e.id === id);

    if (!event) {
      return res.status(404).send('Event not found');
    }

    const [startYearStr, startMonthStr, startDayStr] = event.date.split('-');
    const sYear = parseInt(startYearStr, 10) || 2026;
    const sMonth = parseInt(startMonthStr, 10) || 1;
    const sDay = parseInt(startDayStr, 10) || 1;

    const endEffectiveDate = event.endDate || event.date;
    const [endYearStr, endMonthStr, endDayStr] = endEffectiveDate.split('-');
    const eYear = parseInt(endYearStr, 10) || sYear;
    const eMonth = parseInt(endMonthStr, 10) || sMonth;
    const eDay = parseInt(endDayStr, 10) || sDay;

    const pad = (n: number) => n < 10 ? `0${n}` : `${n}`;
    const isAllDay = !event.startTime || (event.category === 'celebration' && !event.startTime);

    let startHours = 9;
    let startMins = 0;
    let endHours = 10;
    let endMins = 0;

    if (event.startTime) {
      const [h, m] = event.startTime.split(':').map(v => parseInt(v, 10));
      if (!isNaN(h)) startHours = h;
      if (!isNaN(m)) startMins = m;
    }

    if (event.endTime) {
      const [h, m] = event.endTime.split(':').map(v => parseInt(v, 10));
      if (!isNaN(h)) endHours = h;
      if (!isNaN(m)) endMins = m;
    } else {
      endHours = (startHours + 1) % 24;
      endMins = startMins;
    }

    const escapeText = (str: string) =>
      (str || '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r?\n/g, '\\n');

    const startDateStr = `${sYear}${pad(sMonth)}${pad(sDay)}`;
    // RFC 5545: all-day DTEND is exclusive, so the day after the last day
    const exclusiveEnd = new Date(eYear, eMonth - 1, eDay + 1);
    const endDateStr = `${exclusiveEnd.getFullYear()}${pad(exclusiveEnd.getMonth() + 1)}${pad(exclusiveEnd.getDate())}`;

    const startTimeUtcStr = `${startDateStr}T${pad(startHours)}${pad(startMins)}00`;
    const endTimeUtcStr = `${eYear}${pad(eMonth)}${pad(eDay)}T${pad(endHours)}${pad(endMins)}00`;

    const now = new Date();
    const timestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
    const uid = `event-${event.id}-${Date.now()}@sakk-calendar`;

    let description = event.description || '';
    if (event.submitterName) {
      description += `\\n\\nOrganizer: ${event.submitterName} (${event.submitterEmail || ''})`;
    }
    if (event.category) {
      description += `\\nCategory: ${event.category}`;
    }

    const dtStart = isAllDay ? `DTSTART;VALUE=DATE:${startDateStr}` : `DTSTART:${startTimeUtcStr}`;
    const dtEnd = isAllDay ? `DTEND;VALUE=DATE:${endDateStr}` : `DTEND:${endTimeUtcStr}`;

    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SAKK//Community Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${timestamp}`,
      dtStart,
      dtEnd,
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(description)}`,
      `LOCATION:${escapeText(event.location || '')}`,
      `CATEGORIES:${escapeText(event.category || 'Event')}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ];

    const safeFilename = (event.title || 'calendar_event')
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .slice(0, 50);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}_${event.date}.ics"`);
    res.send(icsLines.join('\r\n'));
  });

  // Telegram Settings & Test Endpoints
  app.get('/api/telegram/settings', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const isAdmin = user?.role === 'admin';

    // Redact sensitive configuration details if requester is not an admin
    if (!isAdmin) {
      return res.json({
        isConfigured: telegramConfig.isConfigured,
        isAdmin: false,
      });
    }

    res.json({
      adminChatId: telegramConfig.adminChatId,
      adminTopicId: telegramConfig.adminTopicId || '',
      eventsChatId: telegramConfig.eventsChatId || telegramConfig.channelChatId || '',
      eventsTopicId: telegramConfig.eventsTopicId || '',
      channelChatId: telegramConfig.channelChatId,
      notifyOnSubmission: telegramConfig.notifyOnSubmission,
      notifyOnApproval: telegramConfig.notifyOnApproval,
      notifyOnReschedule: telegramConfig.notifyOnReschedule,
      notifyDailyReminders: telegramConfig.notifyDailyReminders,
      notifyMonthlyCalendar: telegramConfig.notifyMonthlyCalendar !== false,
      monthlyPostDay: telegramConfig.monthlyPostDay || 1,
      includeCalendarImage: telegramConfig.includeCalendarImage !== false,
      lastMonthlyPost: telegramConfig.lastMonthlyPost,
      isConfigured: telegramConfig.isConfigured,
      hasBotToken: Boolean(telegramConfig.botToken),
      maskedToken: telegramConfig.botToken
        ? `${telegramConfig.botToken.substring(0, 4)}...${telegramConfig.botToken.substring(telegramConfig.botToken.length - 4)}`
        : '',
      lastTestStatus: telegramConfig.lastTestStatus,
      isAdmin: true,
    });
  });

  app.post('/api/telegram/settings', requireAdmin, (req: Request, res: Response) => {
    const {
      botToken,
      adminChatId,
      adminTopicId,
      eventsChatId,
      eventsTopicId,
      channelChatId,
      notifyOnSubmission,
      notifyOnApproval,
      notifyOnReschedule,
      notifyDailyReminders,
      notifyMonthlyCalendar,
      monthlyPostDay,
      includeCalendarImage,
    } = req.body;

    if (botToken !== undefined && typeof botToken === 'string') {
      const trimmedToken = botToken.trim();
      if (trimmedToken) {
        if (!/^\d+:[A-Za-z0-9_-]+$/.test(trimmedToken)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid Telegram Bot Token format. Tokens look like 1234567890:AAF... from @BotFather (not the bot username or name).'
          });
        }
        telegramConfig.botToken = trimmedToken;
      }
      // If empty string was submitted, preserve existing token
    }
    if (adminChatId !== undefined) telegramConfig.adminChatId = adminChatId.trim();
    if (adminTopicId !== undefined) telegramConfig.adminTopicId = adminTopicId.trim();
    if (eventsChatId !== undefined) telegramConfig.eventsChatId = eventsChatId.trim();
    if (eventsTopicId !== undefined) telegramConfig.eventsTopicId = eventsTopicId.trim();
    if (channelChatId !== undefined) telegramConfig.channelChatId = channelChatId.trim();
    if (notifyOnSubmission !== undefined) telegramConfig.notifyOnSubmission = Boolean(notifyOnSubmission);
    if (notifyOnApproval !== undefined) telegramConfig.notifyOnApproval = Boolean(notifyOnApproval);
    if (notifyOnReschedule !== undefined) telegramConfig.notifyOnReschedule = Boolean(notifyOnReschedule);
    if (notifyDailyReminders !== undefined) telegramConfig.notifyDailyReminders = Boolean(notifyDailyReminders);
    if (notifyMonthlyCalendar !== undefined) telegramConfig.notifyMonthlyCalendar = Boolean(notifyMonthlyCalendar);
    if (monthlyPostDay !== undefined) {
      const day = parseInt(monthlyPostDay, 10);
      if (!isNaN(day) && day >= 1 && day <= 28) {
        telegramConfig.monthlyPostDay = day;
      }
    }
    if (includeCalendarImage !== undefined) telegramConfig.includeCalendarImage = Boolean(includeCalendarImage);

    telegramConfig.isConfigured = Boolean(
      telegramConfig.botToken &&
      (telegramConfig.adminChatId || telegramConfig.eventsChatId || telegramConfig.channelChatId)
    );

    savePersistedTelegramConfig(telegramConfig);

    broadcastSSE('TELEGRAM_CONFIG_UPDATED', {
      isConfigured: telegramConfig.isConfigured,
      lastMonthlyPost: telegramConfig.lastMonthlyPost,
    });

    res.json({
      success: true,
      message: 'Telegram settings updated successfully.',
      isConfigured: telegramConfig.isConfigured,
    });
  });

  app.post('/api/telegram/test', requireAdmin, async (req: Request, res: Response) => {
    const {
      botToken,
      adminChatId,
      adminTopicId,
      eventsChatId,
      eventsTopicId,
      topicId,
      targetType = 'admin'
    } = req.body;

    let tokenToTest = botToken?.trim() || telegramConfig.botToken;
    if (tokenToTest && !/^\d+:[A-Za-z0-9_-]+$/.test(tokenToTest)) {
      if (telegramConfig.botToken && /^\d+:[A-Za-z0-9_-]+$/.test(telegramConfig.botToken)) {
        tokenToTest = telegramConfig.botToken;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid Telegram Bot Token format. Tokens look like 1234567890:AAF... from @BotFather (not the bot username or name).'
        });
      }
    }
    let chatToTest = '';
    let topicToTest: string | undefined = undefined;

    if (targetType === 'events') {
      const resolved = getEventsChatAndTopic(eventsChatId, eventsTopicId || topicId);
      chatToTest = resolved.chatId;
      topicToTest = resolved.topicId;
    } else {
      const resolved = getAdminChatAndTopic(adminChatId, adminTopicId || topicId);
      chatToTest = resolved.chatId;
      topicToTest = resolved.topicId;
    }

    if (!tokenToTest || !chatToTest) {
      return res.status(400).json({
        success: false,
        error: `Both Telegram Bot Token and ${targetType === 'events' ? 'Events Chat ID' : 'Admin Chat ID'} are required to run a test.`,
      });
    }

    const topicBadge = topicToTest ? ` (Topic #${topicToTest})` : '';
    const testMsg =
      targetType === 'events'
        ? `🎉 <b>Community Events Chat: Connection Verified!</b>\n\n` +
          `This chat/topic${topicBadge} is configured to receive automatic event announcements upon admin approval, rescheduling notices, upcoming reminders, and monthly calendar publications.\n\n` +
          `🕒 Connected: ${new Date().toLocaleString()}`
        : `🎉 <b>Calendar App: Telegram Admin Alerts Connected!</b>\n\n` +
          `Your bot is configured to dispatch real-time administrator approval alerts and incoming event submissions to this topic${topicBadge}.\n\n` +
          `🕒 Server Time: ${new Date().toLocaleString()}`;

    // Temporarily test with provided credentials
    const originalToken = telegramConfig.botToken;
    telegramConfig.botToken = tokenToTest;

    const result = await sendTelegramMessage(testMsg, chatToTest, topicToTest);

    telegramConfig.lastTestStatus = {
      success: result.success,
      timestamp: new Date().toISOString(),
      message: result.success
        ? `Test message delivered to ${targetType === 'events' ? 'Events' : 'Admin'} chat${topicBadge}`
        : result.error,
    };

    if (!botToken) telegramConfig.botToken = originalToken;
    savePersistedTelegramConfig(telegramConfig);

    res.json({
      ...result,
      postedToChat: chatToTest,
      postedToTopic: result.postedToTopic !== undefined ? result.postedToTopic : topicToTest,
    });
  });

  // Post an approved event directly to the separate events chat
  app.post('/api/telegram/post-approved-event', requireAdmin, async (req: Request, res: Response) => {
    const { eventId, targetChatId, targetTopicId } = req.body;
    const event = eventsStore.find(e => e.id === eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found.' });
    }

    const { chatId: targetChat, topicId: targetTopic } = getEventsChatAndTopic(targetChatId, targetTopicId);
    if (!targetChat) {
      return res.status(400).json({
        success: false,
        error: 'No Events Chat ID configured. Please configure an Events Chat in Telegram Settings.',
      });
    }

    const timeStr = event.startTime
      ? `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ''}`
      : (event.category === 'celebration' ? 'All Day Celebration' : 'All Day / Untimed');

    const dateRangeDisplay = formatEventDateRange(event.date, event.endDate);

    const tgMsg =
      `🎉 <b>COMMUNITY EVENT SPOTLIGHT</b>\n\n` +
      `📌 <b>${event.title}</b>\n` +
      `📅 <b>Date${event.isMultiDay ? 's' : ''}:</b> ${dateRangeDisplay}\n` +
      `⏰ <b>Time:</b> ${timeStr}\n` +
      `🏷️ <b>Category:</b> ${event.category.toUpperCase()}\n` +
      `📍 <b>Location:</b> ${event.location || 'Community Venue / Virtual'}\n` +
      `👤 <b>Organizer:</b> ${event.submitterName}\n` +
      (event.expectedAttendees ? `👥 <b>Expected Attendees:</b> ${event.expectedAttendees}\n` : '') +
      (event.equipmentNeeds ? `🛠️ <b>Equipment/Notes:</b> ${event.equipmentNeeds}\n` : '') +
      `\n📝 <b>Event Details:</b>\n${event.description || 'Join us for this scheduled community event!'}\n\n` +
      `🔗 <i>Live on the official community calendar.</i>`;

    const result = await sendTelegramMessage(tgMsg, targetChat, targetTopic);
    if (result.success) {
      event.telegramNotified = true;
      saveEvents(eventsStore);
    }

    res.json({
      ...result,
      postedToChat: targetChat,
      postedToTopic: targetTopic,
    });
  });

  // Export monthly calendar overview with image to the separate events chat
  app.post('/api/telegram/post-monthly-calendar', requireAdmin, async (req: Request, res: Response) => {
    const { month, year, imageBase64, customNote, targetChatId, targetTopicId } = req.body;

    const m = typeof month === 'number' ? month : new Date().getMonth();
    const y = typeof year === 'number' ? year : new Date().getFullYear();

    const monthDate = new Date(y, m, 1);
    const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
    const monthStartStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const monthEndStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    const monthEvents = eventsStore
      .filter(e => e.status === 'approved' && (
        (e.date >= monthStartStr && e.date <= monthEndStr) ||
        (e.endDate && e.date <= monthEndStr && e.endDate >= monthStartStr)
      ))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));

    const { chatId: targetChat, topicId: targetTopic } = getEventsChatAndTopic(targetChatId, targetTopicId);

    if (!telegramConfig.botToken || !targetChat) {
      return res.status(400).json({
        success: false,
        error: 'Telegram bot credentials or target Events Chat ID is missing. Please configure in Telegram settings.',
      });
    }

    // Category breakdown
    const categoryCounts: Record<string, number> = {};
    monthEvents.forEach(e => {
      categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
    });

    const categorySummary = Object.entries(categoryCounts)
      .map(([cat, count]) => `• ${cat}: ${count}`)
      .join('\n');

    // Chronological highlights
    const highlights = monthEvents.slice(0, 8).map(e => {
      const startDay = parseInt(e.date.split('-')[2], 10);
      const timeBadge = e.startTime ? ` (${e.startTime})` : '';
      if (e.isMultiDay && e.endDate) {
        const endDay = parseInt(e.endDate.split('-')[2], 10);
        return `• <b>Days ${startDay}–${endDay}:</b> ${e.title}${timeBadge}`;
      }
      return `• <b>Day ${startDay}:</b> ${e.title}${timeBadge}`;
    }).join('\n');

    let caption =
      `🗓️ <b>COMMUNITY CALENDAR — ${monthName.toUpperCase()}</b>\n` +
      `✨ <i>${monthEvents.length} event${monthEvents.length === 1 ? '' : 's'} scheduled this month</i>\n\n`;

    if (customNote && customNote.trim()) {
      caption += `📢 <i>${customNote.trim()}</i>\n\n`;
    }

    if (categorySummary) {
      caption += `📊 <b>Monthly Breakdown:</b>\n${categorySummary}\n\n`;
    }

    if (highlights) {
      caption += `📌 <b>Schedule Highlights:</b>\n${highlights}\n\n`;
    }

    caption += `🔗 <i>RSVP and inspect daily itineraries on our live community calendar!</i>`;

    let result: { success: boolean; error?: string; postedToChat?: string; postedToTopic?: string };

    if (imageBase64 && typeof imageBase64 === 'string' && imageBase64.length > 50) {
      const filename = `Calendar_${monthName.replace(/\s+/g, '_')}.png`;
      result = await sendTelegramPhoto(imageBase64, caption, targetChat, targetTopic, filename);
    } else {
      result = await sendTelegramMessage(caption, targetChat, targetTopic);
    }

    telegramConfig.lastMonthlyPost = {
      timestamp: new Date().toISOString(),
      chatId: targetChat,
      topicId: targetTopic,
      success: result.success,
      hasImage: Boolean(imageBase64),
      message: result.error || 'Successfully posted monthly calendar overview',
    };
    telegramConfig.lastMonthlyPostMonth = `${y}-${m + 1}`;

    broadcastSSE('TELEGRAM_CONFIG_UPDATED', {
      lastMonthlyPost: telegramConfig.lastMonthlyPost,
    });

    res.json({
      ...result,
      postedToChat: targetChat,
      postedToTopic: targetTopic,
      hasPhoto: Boolean(imageBase64),
      monthName,
      eventsCount: monthEvents.length,
    });
  });

  // Send Telegram Reminder for upcoming event or all upcoming events
  app.post('/api/telegram/reminders/send', requireAdmin, async (req: Request, res: Response) => {
    const { eventId, targetChatId, targetTopicId } = req.body;
    const { chatId: targetChat, topicId: targetTopic } = getEventsChatAndTopic(targetChatId, targetTopicId);

    if (!targetChat) {
      return res.status(400).json({
        success: false,
        error: 'No Events Chat ID configured. Please configure in Telegram Settings.',
      });
    }

    if (eventId) {
      const event = eventsStore.find(e => e.id === eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const dateRangeDisplay = formatEventDateRange(event.date, event.endDate);
      const timeStr = event.startTime
        ? `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ''}`
        : 'All Day / Untimed';

      const tgMsg =
        `⏰ <b>Upcoming Event Reminder</b>\n\n` +
        `📌 <b>${event.title}</b>\n` +
        `📅 <b>Date${event.isMultiDay ? 's' : ''}:</b> ${dateRangeDisplay}\n` +
        `🕒 <b>Time:</b> ${timeStr}\n` +
        `📍 <b>Location:</b> ${event.location}\n\n` +
        `📝 ${event.description}\n\n` +
        `See full calendar for details.`;

      const result = await sendTelegramMessage(tgMsg, targetChat, targetTopic);
      return res.json({
        ...result,
        postedToChat: targetChat,
        postedToTopic: targetTopic,
      });
    }

    // Default: find today or upcoming approved events
    const today = new Date().toISOString().split('T')[0];
    const upcoming = eventsStore
      .filter(e => e.status === 'approved' && (e.date >= today || (e.endDate && e.endDate >= today)))
      .slice(0, 5);

    if (upcoming.length === 0) {
      return res.json({ success: true, message: 'No upcoming approved events scheduled for reminders.' });
    }

    let summary = `📅 <b>Upcoming Scheduled Events Reminder</b>\n\n`;
    upcoming.forEach((e, idx) => {
      const dateDisplay = formatEventDateRange(e.date, e.endDate);
      const timeDisplay = e.startTime ? ` at ${e.startTime}` : '';
      summary += `${idx + 1}. <b>${e.title}</b>\n   🗓️ ${dateDisplay}${timeDisplay}\n   📍 ${e.location}\n\n`;
    });

    const result = await sendTelegramMessage(summary, targetChat, targetTopic);
    res.json({
      ...result,
      postedToChat: targetChat,
      postedToTopic: targetTopic,
    });
  });

  // Google Apps Script code generator
  app.get('/api/google-form-script', (req: Request, res: Response) => {
    const rawAppUrl = process.env.APP_URL?.trim();
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3001';
    const webhookUrl = rawAppUrl
      ? `${rawAppUrl.replace(/\/$/, '')}/api/webhooks/google-form`
      : `${protocol}://${host}/api/webhooks/google-form`;

    const script = `/**
 * Google Apps Script for Automated Live Calendar Submissions
 * 
 * Instructions:
 * 1. Open your Google Form in your browser.
 * 2. Click the 3 dots (More) -> Script editor.
 * 3. Paste this code completely into Code.gs.
 * 4. Click Triggers (clock icon on the left) -> Add Trigger:
 *    - Function: onFormSubmit
 *    - Event source: From form
 *    - Event type: On form submit
 * 5. Save and submit a test response!
 */

const WEBHOOK_URL = "${webhookUrl}";

function onFormSubmit(e) {
  try {
    const itemResponses = e.response.getItemResponses();
    const payload = {
      source: "google_form",
      formSubmissionId: e.response.getId(),
      timestamp: e.response.getTimestamp().toISOString(),
    };

    // Extract each question title and its answer
    for (var i = 0; i < itemResponses.length; i++) {
      var itemResponse = itemResponses[i];
      var questionTitle = itemResponse.getItem().getTitle();
      var answer = itemResponse.getResponse();
      payload[questionTitle] = answer;
    }

    // Attempt common field mappings
    for (var key in payload) {
      var k = key.toLowerCase();
      if (k.indexOf('title') !== -1 || k.indexOf('event name') !== -1) payload.title = payload[key];
      if (k.indexOf('category') !== -1 || k.indexOf('type') !== -1) payload.category = payload[key];
      if ((k.indexOf('end') !== -1 || k.indexOf('until') !== -1) && k.indexOf('date') !== -1) {
        payload.endDate = payload[key];
      } else if (k.indexOf('date') !== -1) {
        payload.date = payload[key];
      }
      if (k.indexOf('start') !== -1 && k.indexOf('time') !== -1) payload.startTime = payload[key];
      if (k.indexOf('end') !== -1 && k.indexOf('time') !== -1) payload.endTime = payload[key];
      if (k.indexOf('preferred') !== -1 || (k.indexOf('name') !== -1 && k.indexOf('event') === -1)) payload.submitterName = payload[key];
      if (k.indexOf('telegram') !== -1 || k.indexOf('handle') !== -1 || k.indexOf('email') !== -1) payload.submitterEmail = payload[key];
      if (k.indexOf('location') !== -1 || k.indexOf('venue') !== -1 || k.indexOf('link') !== -1) payload.location = payload[key];
      if (k.indexOf('desc') !== -1 || k.indexOf('detail') !== -1) payload.description = payload[key];
    }

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log("Webhook Response: " + response.getContentText());
  } catch (err) {
    Logger.log("Error in onFormSubmit: " + err.toString());
  }
}
`;
    res.setHeader('Content-Type', 'text/plain');
    res.send(script);
  });

  // Mark all notifications as read
  app.post('/api/notifications/read-all', requireAdmin, (_req: Request, res: Response) => {
    notificationsStore.forEach(n => { n.read = true; });
    saveNotifications(notificationsStore);
    res.json({ success: true });
  });

  // Vite middleware in dev mode / static build in production
  const isRunningFromDist = __filename.includes('dist') || (Boolean(process.argv[1]) && process.argv[1].includes('dist'));
  const hasDistFiles = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));
  const isProduction = process.env.NODE_ENV === 'production' || (isRunningFromDist && hasDistFiles);

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Periodic background check for automated monthly calendar posts & daily reminders
  setInterval(async () => {
    try {
      if (!telegramConfig.isConfigured) return;
      const { chatId: targetChat, topicId: targetTopic } = getEventsChatAndTopic();
      if (!targetChat) return;

      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // 1. Daily Event Reminders to Events Topic (e.g. at/after 8 AM)
      if (telegramConfig.notifyDailyReminders && (telegramConfig as any).lastDailyReminderDate !== todayKey && now.getHours() >= 8) {
        const todayEvents = eventsStore
          .filter(e => e.status === 'approved' && (e.date === todayKey || (e.endDate && e.date <= todayKey && e.endDate >= todayKey)))
          .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

        if (todayEvents.length > 0) {
          let reminderMsg = `☀️ <b>TODAY'S COMMUNITY SCHEDULE — ${todayKey}</b>\n\n`;
          todayEvents.forEach((e, idx) => {
            const timeStr = e.startTime ? `${e.startTime}${e.endTime ? ` – ${e.endTime}` : ''}` : 'All Day';
            const multiDayBadge = e.isMultiDay && e.endDate
              ? ` [Day ${calculateDaysBetween(e.date, todayKey)} of ${calculateDaysBetween(e.date, e.endDate)}]`
              : '';
            reminderMsg += `${idx + 1}. <b>${e.title}</b>${multiDayBadge}\n   ⏰ ${timeStr}\n   📍 ${e.location}\n\n`;
          });
          reminderMsg += `🔗 <i>View full itineraries on the live community calendar!</i>`;
          await sendTelegramMessage(reminderMsg, targetChat, targetTopic);
        }
        (telegramConfig as any).lastDailyReminderDate = todayKey;
      }

      // 2. Monthly Automated Calendar Overview
      const currentDay = now.getDate();
      const targetDay = telegramConfig.monthlyPostDay || 1;
      const currentMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

      if (telegramConfig.notifyMonthlyCalendar && currentDay === targetDay && telegramConfig.lastMonthlyPostMonth !== currentMonthKey) {
        console.log(`Executing automated monthly calendar post for ${currentMonthKey}...`);
        const month = now.getMonth();
        const year = now.getFullYear();
        const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        const monthStartStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const monthEndStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

        const monthEvents = eventsStore
          .filter(e => e.status === 'approved' && (
            (e.date >= monthStartStr && e.date <= monthEndStr) ||
            (e.endDate && e.date <= monthEndStr && e.endDate >= monthStartStr)
          ))
          .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));

        const categoryCounts: Record<string, number> = {};
        monthEvents.forEach(e => {
          categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
        });
        const categorySummary = Object.entries(categoryCounts)
          .map(([cat, count]) => `• ${cat}: ${count}`)
          .join('\n');

        const highlights = monthEvents.slice(0, 8).map(e => {
          const startDay = parseInt(e.date.split('-')[2], 10);
          const timeBadge = e.startTime ? ` (${e.startTime})` : '';
          if (e.isMultiDay && e.endDate) {
            const endDay = parseInt(e.endDate.split('-')[2], 10);
            return `• <b>Days ${startDay}–${endDay}:</b> ${e.title}${timeBadge}`;
          }
          return `• <b>Day ${startDay}:</b> ${e.title}${timeBadge}`;
        }).join('\n');

        const caption =
          `🗓️ <b>AUTOMATED MONTHLY CALENDAR — ${monthName.toUpperCase()}</b>\n` +
          `✨ <i>${monthEvents.length} event${monthEvents.length === 1 ? '' : 's'} scheduled this month</i>\n\n` +
          (categorySummary ? `📊 <b>Monthly Breakdown:</b>\n${categorySummary}\n\n` : '') +
          (highlights ? `📌 <b>Schedule Highlights:</b>\n${highlights}\n\n` : '') +
          `🔗 <i>Explore full itineraries & RSVP on our live community calendar!</i>`;

        const result = await sendTelegramMessage(caption, targetChat, targetTopic);
        telegramConfig.lastMonthlyPost = {
          timestamp: new Date().toISOString(),
          chatId: targetChat,
          topicId: targetTopic,
          success: result.success,
          hasImage: false,
          message: result.error || 'Automated monthly post dispatched to events chat',
        };
        telegramConfig.lastMonthlyPostMonth = currentMonthKey;
      }
    } catch (err) {
      console.error('Error during automated background telegram check:', err);
    }
  }, 30 * 60 * 1000);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Live Calendar Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
