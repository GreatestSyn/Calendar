import fs from 'fs';
import path from 'path';
import {
  loadEvents,
  saveEvents,
  loadNotifications,
  saveNotifications,
  createStartupBackup,
} from '../src/server/storage';
import { CalendarEvent, AdminNotification } from '../src/types';

async function runTests() {
  console.log('--- TEST SUITE: PERSISTENT STORAGE LAYER ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  const dataDir = path.resolve(process.cwd(), 'data');
  const eventsFile = path.join(dataDir, 'events.json');
  const notifsFile = path.join(dataDir, 'notifications.json');
  const backupsDir = path.join(dataDir, 'backups');

  // Backup existing data if any
  const originalEvents = fs.existsSync(eventsFile) ? fs.readFileSync(eventsFile, 'utf-8') : null;
  const originalNotifs = fs.existsSync(notifsFile) ? fs.readFileSync(notifsFile, 'utf-8') : null;

  try {
    // Test 1: Save and Load Events
    const testEvent: CalendarEvent = {
      id: 'test-evt-001',
      title: 'Persistent Board Meeting',
      category: 'SAKK meeting',
      date: '2026-10-15',
      startTime: '14:00',
      endTime: '15:30',
      status: 'pending',
      submitterName: 'Alice Organizer',
      submitterEmail: 'alice@example.com',
      location: 'Main Hall',
      description: 'Quarterly general meeting',
      submittedAt: new Date().toISOString(),
      source: 'direct_submission',
    };

    const saveSuccess = saveEvents([testEvent]);
    assert(saveSuccess, 'saveEvents returns true');
    assert(fs.existsSync(eventsFile), 'data/events.json exists on disk');

    const loadedEvents = loadEvents();
    assert(loadedEvents.length === 1, 'loadEvents returns 1 event');
    assert(loadedEvents[0].id === 'test-evt-001', 'Loaded event has matching ID');
    assert(loadedEvents[0].title === 'Persistent Board Meeting', 'Loaded event has matching title');

    // Test 2: Mutation and Persistence (Approve status)
    loadedEvents[0].status = 'approved';
    loadedEvents[0].approvedBy = 'Admin User';
    saveEvents(loadedEvents);

    const reloadedEvents = loadEvents();
    assert(reloadedEvents[0].status === 'approved', 'Modified status persists to disk');
    assert(reloadedEvents[0].approvedBy === 'Admin User', 'approvedBy field persists to disk');

    // Test 3: Save and Load Notifications
    const testNotif: AdminNotification = {
      id: 'test-notif-001',
      title: 'New Submission Alert',
      message: 'Alice submitted an event',
      type: 'submission',
      eventId: 'test-evt-001',
      timestamp: new Date().toISOString(),
      read: false,
    };

    const saveNotifSuccess = saveNotifications([testNotif]);
    assert(saveNotifSuccess, 'saveNotifications returns true');
    assert(fs.existsSync(notifsFile), 'data/notifications.json exists on disk');

    const loadedNotifs = loadNotifications();
    assert(loadedNotifs.length === 1, 'loadNotifications returns 1 notification');
    assert(loadedNotifs[0].id === 'test-notif-001', 'Notification has matching ID');

    // Test 4: Startup Backup Creation & Pruning
    createStartupBackup();
    assert(fs.existsSync(backupsDir), 'data/backups/ directory created');
    const backupFiles = fs.readdirSync(backupsDir);
    assert(backupFiles.some(f => f.startsWith('events-backup-')), 'events-backup file generated');
    assert(backupFiles.some(f => f.startsWith('notifications-backup-')), 'notifications-backup file generated');

    // Test 5: Deletion Persistence
    saveEvents([]);
    const emptyEvents = loadEvents();
    assert(emptyEvents.length === 0, 'Empty array persists after deletion');

    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    // Restore original state if there was any
    if (originalEvents !== null) {
      fs.writeFileSync(eventsFile, originalEvents, 'utf-8');
    } else if (fs.existsSync(eventsFile)) {
      fs.unlinkSync(eventsFile);
    }

    if (originalNotifs !== null) {
      fs.writeFileSync(notifsFile, originalNotifs, 'utf-8');
    } else if (fs.existsSync(notifsFile)) {
      fs.unlinkSync(notifsFile);
    }
  }
}

runTests().catch((e) => {
  console.error('Test suite encountered an error:', e);
  process.exit(1);
});

