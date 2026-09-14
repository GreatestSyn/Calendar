import fs from 'fs';
import path from 'path';
import { CalendarEvent as BaseCalendarEvent, AdminNotification } from '../types';

export type CalendarEvent = Omit<BaseCalendarEvent, 'category'> & {
  category: string;
};

const DATA_DIR = path.resolve(process.cwd(), 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

const MAX_BACKUPS_TO_KEEP = 7;

/**
 * Ensures a directory exists on disk.
 */
function ensureDirectoryExists(dirPath: string): void {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (err) {
    console.error(`[Storage] Failed to create directory: ${dirPath}`, err);
  }
}

/**
 * Writes data atomically to disk using a temporary file and rename.
 * This guarantees the destination file is never corrupted if a crash or power cut occurs mid-write.
 */
function atomicWriteJson(filePath: string, data: any): boolean {
  ensureDirectoryExists(path.dirname(filePath));
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;

  try {
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempPath, jsonString, 'utf-8');
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (err) {
    console.error(`[Storage] Failed to write atomically to ${filePath}:`, err);
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // ignore cleanup errors
    }
    return false;
  }
}

/**
 * Loads events from ./data/events.json.
 * If the file does not exist, returns an empty array.
 */
export function loadEvents(): CalendarEvent[] {
  ensureDirectoryExists(DATA_DIR);
  if (!fs.existsSync(EVENTS_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(EVENTS_FILE, 'utf-8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      console.log(`[Storage] Loaded ${parsed.length} event(s) from ${EVENTS_FILE}`);
      return parsed;
    }
    console.warn(`[Storage] ${EVENTS_FILE} did not contain an array. Defaulting to empty list.`);
    return [];
  } catch (err) {
    console.error(`[Storage] Failed to parse ${EVENTS_FILE}:`, err);
    return [];
  }
}

/**
 * Saves events to ./data/events.json atomically.
 */
export function saveEvents(events: CalendarEvent[]): boolean {
  return atomicWriteJson(EVENTS_FILE, events);
}

/**
 * Loads notifications from ./data/notifications.json.
 */
export function loadNotifications(): AdminNotification[] {
  ensureDirectoryExists(DATA_DIR);
  if (!fs.existsSync(NOTIFICATIONS_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.error(`[Storage] Failed to parse ${NOTIFICATIONS_FILE}:`, err);
    return [];
  }
}

/**
 * Saves notifications to ./data/notifications.json atomically.
 */
export function saveNotifications(notifications: AdminNotification[]): boolean {
  return atomicWriteJson(NOTIFICATIONS_FILE, notifications);
}

/**
 * Cleans up older backup files, keeping the most recent N files.
 */
function pruneOldBackups(prefix: string, maxToKeep: number): void {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return;
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(name => name.startsWith(prefix) && name.endsWith('.json'))
      .map(name => ({
        name,
        fullPath: path.join(BACKUPS_DIR, name),
        mtime: fs.statSync(path.join(BACKUPS_DIR, name)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    if (files.length > maxToKeep) {
      const toRemove = files.slice(maxToKeep);
      for (const item of toRemove) {
        try {
          fs.unlinkSync(item.fullPath);
          console.log(`[Storage] Pruned old backup: ${item.name}`);
        } catch (e) {
          console.warn(`[Storage] Failed to delete old backup ${item.name}:`, e);
        }
      }
    }
  } catch (err) {
    console.warn('[Storage] Error during backup pruning:', err);
  }
}

/**
 * Creates timestamped snapshot backups of the events and notifications databases.
 * Runs once upon server startup to ensure you always have a historical rollback point.
 */
export function createStartupBackup(): void {
  ensureDirectoryExists(BACKUPS_DIR);
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

  if (fs.existsSync(EVENTS_FILE)) {
    try {
      const backupPath = path.join(BACKUPS_DIR, `events-backup-${timestamp}.json`);
      fs.copyFileSync(EVENTS_FILE, backupPath);
      console.log(`[Storage] Startup backup created: ${backupPath}`);
      pruneOldBackups('events-backup-', MAX_BACKUPS_TO_KEEP);
    } catch (err) {
      console.error('[Storage] Failed to create events startup backup:', err);
    }
  }

  if (fs.existsSync(NOTIFICATIONS_FILE)) {
    try {
      const backupPath = path.join(BACKUPS_DIR, `notifications-backup-${timestamp}.json`);
      fs.copyFileSync(NOTIFICATIONS_FILE, backupPath);
      pruneOldBackups('notifications-backup-', MAX_BACKUPS_TO_KEEP);
    } catch (err) {
      console.error('[Storage] Failed to create notifications startup backup:', err);
    }
  }
}
