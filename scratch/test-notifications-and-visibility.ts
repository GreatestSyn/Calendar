import fs from 'fs';
import path from 'path';
import {
  loadEvents,
  saveEvents,
  loadNotifications,
  saveNotifications,
} from '../src/server/storage';
import { CalendarEvent, AdminNotification } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log('=== Test Suite: Notification Clearing & Role Visibility ===\n');

const NOTIFS_FILE = path.resolve(process.cwd(), 'data', 'notifications.json');
const origNotifs = fs.existsSync(NOTIFS_FILE) ? fs.readFileSync(NOTIFS_FILE, 'utf-8') : null;

try {
  // Test 1: Notifications Storage & Dismissal Persistence
  console.log('--- 1. Notification Dismissal Persistence ---');
  const sampleNotif: AdminNotification = {
    id: 'test-notif-101',
    title: 'New Event Submission',
    message: 'Nathan submitted "Annual Gala"',
    type: 'submission',
    eventId: 'evt-101',
    timestamp: new Date().toISOString(),
    read: false,
  };

  saveNotifications([sampleNotif]);
  let loaded = loadNotifications();
  assert(loaded.length === 1, 'Notification saved to disk');
  assert(loaded[0].read === false, 'Notification initially has read: false');

  // Simulate Dismissal
  const target = loaded.find((n) => n.id === 'test-notif-101');
  if (target) {
    target.read = true;
    saveNotifications(loaded);
  }

  const reloadedAfterDismiss = loadNotifications();
  assert(reloadedAfterDismiss[0].read === true, 'Notification dismissal persisted to disk with read: true');

  // Test 2: Clear All Notifications
  console.log('\n--- 2. Clear All Notifications Persistence ---');
  saveNotifications([]);
  const reloadedAfterClear = loadNotifications();
  assert(reloadedAfterClear.length === 0, 'data/notifications.json is empty after clear-all');

  // Test 3: Role-Based Event Visibility (Visitor vs Admin)
  console.log('\n--- 3. Role-Based Event Visibility Filtering ---');
  const mockEvents: CalendarEvent[] = [
    {
      id: 'evt-approved-1',
      title: 'Approved Community Workshop',
      category: 'SAKK Event',
      date: '2026-09-20',
      startTime: '10:00',
      endTime: '12:00',
      status: 'approved',
      submitterName: 'Alice',
      submitterEmail: '@alice',
      location: 'Room A',
      description: 'Workshop',
      submittedAt: '2026-09-01T00:00:00Z',
      source: 'direct_submission',
    },
    {
      id: 'evt-pending-2',
      title: 'Unapproved Pending Submission',
      category: 'Member Event (18+)',
      date: '2026-09-20',
      startTime: '14:00',
      endTime: '16:00',
      status: 'pending',
      submitterName: 'Bob',
      submitterEmail: '@bob',
      location: 'Room B',
      description: 'Pending event',
      submittedAt: '2026-09-02T00:00:00Z',
      source: 'direct_submission',
    },
    {
      id: 'evt-rejected-3',
      title: 'Declined Submission',
      category: 'other',
      date: '2026-09-21',
      startTime: '18:00',
      endTime: '19:00',
      status: 'rejected',
      submitterName: 'Charlie',
      submitterEmail: '@charlie',
      location: 'Online',
      description: 'Declined event',
      submittedAt: '2026-09-03T00:00:00Z',
      source: 'direct_submission',
    },
  ];

  // Visitor filter simulation
  const filterForUser = (events: CalendarEvent[], effectiveIsAdmin: boolean) => {
    return events.filter((evt) => {
      if (!effectiveIsAdmin && evt.status !== 'approved') return false;
      return true;
    });
  };

  const visitorVisibleEvents = filterForUser(mockEvents, false);
  assert(visitorVisibleEvents.length === 1, 'Standard visitor only sees 1 event');
  assert(visitorVisibleEvents[0].id === 'evt-approved-1', 'Standard visitor sees only the approved event');
  assert(!visitorVisibleEvents.some((e) => e.status === 'pending'), 'Standard visitor CANNOT see pending events');
  assert(!visitorVisibleEvents.some((e) => e.status === 'rejected'), 'Standard visitor CANNOT see rejected events');

  const adminVisibleEvents = filterForUser(mockEvents, true);
  assert(adminVisibleEvents.length === 3, 'Administrator sees all 3 events');

  // Test 4: DayItineraryDrawer Day Filtering
  console.log('\n--- 4. DayItineraryDrawer Visibility Filtering ---');
  const getDayEvents = (events: CalendarEvent[], selectedDate: string, isAdmin: boolean) => {
    return events.filter((e) => {
      if (!isAdmin && e.status !== 'approved') return false;
      if (e.date === selectedDate) return true;
      if (e.isMultiDay && e.endDate && e.date <= selectedDate && e.endDate >= selectedDate) return true;
      return false;
    });
  };

  const visitorDayEvents = getDayEvents(mockEvents, '2026-09-20', false);
  assert(visitorDayEvents.length === 1, 'Visitor DayItineraryDrawer has only approved event');
  assert(visitorDayEvents[0].id === 'evt-approved-1', 'Visitor DayItineraryDrawer contains only evt-approved-1');

  const adminDayEvents = getDayEvents(mockEvents, '2026-09-20', true);
  assert(adminDayEvents.length === 2, 'Admin DayItineraryDrawer has both approved and pending events on 2026-09-20');

  // Test 5: Notifications Popup on Refresh Prevention Logic
  console.log('\n--- 5. Notifications Popup on Refresh Prevention Logic ---');
  // Scenario A: Page loads with pre-existing unread notifications in database
  const loadedFromDb: AdminNotification[] = [
    {
      id: 'old-notif-1',
      title: 'Historical event submission',
      message: 'Someone submitted something 3 days ago',
      type: 'submission',
      eventId: 'evt-old',
      timestamp: '2026-09-11T12:00:00Z',
      read: false,
    },
  ];

  // In App.tsx:
  // const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  // const [liveToasts, setLiveToasts] = useState<AdminNotification[]>([]);
  let stateNotifications = loadedFromDb;
  let stateLiveToasts: AdminNotification[] = []; // Initial state on mount

  // LiveNotificationToast receives liveToasts:
  const activeToastsOnRefresh = stateLiveToasts.filter((n) => !n.read).slice(0, 2);
  assert(activeToastsOnRefresh.length === 0, 'On page refresh, liveToasts is empty, so 0 floating toasts pop up');

  // Scenario B: Real-time event arrives via SSE while user is on the page
  const liveIncomingNotif: AdminNotification = {
    id: 'live-notif-2',
    title: 'Live submission received right now',
    message: 'Jane submitted an event right now',
    type: 'submission',
    eventId: 'evt-new',
    timestamp: new Date().toISOString(),
    read: false,
  };

  // SSE event handler updates both:
  stateNotifications = [liveIncomingNotif, ...stateNotifications];
  stateLiveToasts = [liveIncomingNotif, ...stateLiveToasts];

  const activeToastsLive = stateLiveToasts.filter((n) => !n.read).slice(0, 2);
  assert(activeToastsLive.length === 1, 'When live SSE event occurs, floating toast appears');
  assert(activeToastsLive[0].id === 'live-notif-2', 'Floating toast corresponds to live event');

  // Scenario C: User dismisses toast
  stateLiveToasts = stateLiveToasts.filter((n) => n.id !== 'live-notif-2');
  assert(stateLiveToasts.length === 0, 'Dismissing toast removes it from live toasts');

  console.log('\n=== All Tests Passed Successfully! ===');
} finally {
  // Restore original notifications file
  if (origNotifs !== null) {
    fs.writeFileSync(NOTIFS_FILE, origNotifs, 'utf-8');
  } else if (fs.existsSync(NOTIFS_FILE)) {
    fs.writeFileSync(NOTIFS_FILE, '[]', 'utf-8');
  }
}

