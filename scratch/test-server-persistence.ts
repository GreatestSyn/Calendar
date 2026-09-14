import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

const TEST_PORT = 3099;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const NOTIFS_FILE = path.join(DATA_DIR, 'notifications.json');

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function startTestServer(): ChildProcess {
  const child = spawn('npx', ['tsx', 'server.ts'], {
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      NODE_ENV: 'production', // use production mode so Vite dev server doesn't take time to start
      SESSION_SECRET: 'test-session-secret-for-integration-tests-2026',
    },
    shell: true,
    stdio: 'pipe',
  });

  child.stdout?.on('data', (d) => {
    // console.log(`[Server] ${d.toString()}`);
  });
  child.stderr?.on('data', (d) => {
    // console.error(`[Server Err] ${d.toString()}`);
  });

  return child;
}

async function waitForServer(timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return true;
    } catch {
      // wait and retry
    }
    await sleep(250);
  }
  return false;
}

async function runIntegration() {
  console.log('--- INTEGRATION TEST: SERVER RESTART PERSISTENCE ---');
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

  // Backup original state
  const origEvents = fs.existsSync(EVENTS_FILE) ? fs.readFileSync(EVENTS_FILE, 'utf-8') : null;
  const origNotifs = fs.existsSync(NOTIFS_FILE) ? fs.readFileSync(NOTIFS_FILE, 'utf-8') : null;

  let serverProcess: ChildProcess | null = null;

  try {
    // Step 1: Start Server 1
    console.log('Starting Server Instance #1...');
    serverProcess = startTestServer();
    const ready1 = await waitForServer();
    assert(ready1, 'Server Instance #1 booted successfully');

    const testEventTitle = `Community Hackathon ${Date.now()}`;
    // Step 2: Submit Event via POST /api/events
    const submitRes = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: testEventTitle,
        category: 'SAKK Event',
        date: '2026-11-20',
        startTime: '10:00',
        endTime: '18:00',
        submitterName: 'Dave Developer',
        submitterEmail: '@davedev',
        location: 'Innovation Hub',
        description: 'Building live apps together',
      }),
    });

    assert(submitRes.status === 201, 'POST /api/events created event (201)');
    const createdData = await submitRes.json() as any;
    const eventId = createdData.event.id;
    assert(Boolean(eventId), 'Event received a generated ID');

    // Step 3: Check disk immediately
    assert(fs.existsSync(EVENTS_FILE), 'data/events.json exists on disk');
    let diskEvents = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
    assert(diskEvents.some((e: any) => e.id === eventId), 'New event written to data/events.json on disk');

    // Step 4: Login as admin & approve the event
    const loginRes = await fetch(`${BASE_URL}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', email: 'nathan.p.sturm@gmail.com', name: 'Nathan Sturm' }),
    });
    const loginData = await loginRes.json() as any;
    const adminToken = loginData.token;
    assert(Boolean(adminToken), 'Obtained admin authorization token');

    const approveRes = await fetch(`${BASE_URL}/api/events/${eventId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ approvedBy: 'Master Admin' }),
    });
    assert(approveRes.status === 200, 'POST /api/events/:id/approve returned 200');

    // Check disk for approved status
    diskEvents = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
    const diskEvt = diskEvents.find((e: any) => e.id === eventId);
    assert(diskEvt?.status === 'approved', 'data/events.json reflects status: approved');

    // Step 5: Terminate Server Instance #1 (Simulate crash / restart)
    console.log('Terminating Server Instance #1...');
    serverProcess.kill('SIGTERM');
    await sleep(1000);

    // Step 6: Start Server Instance #2 (New boot)
    console.log('Starting Server Instance #2 (Simulated Reboot)...');
    serverProcess = startTestServer();
    const ready2 = await waitForServer();
    assert(ready2, 'Server Instance #2 booted successfully');

    // Step 7: Query public events on Server Instance #2
    const publicEventsRes = await fetch(`${BASE_URL}/api/events`);
    assert(publicEventsRes.status === 200, 'GET /api/events returned 200');
    const publicData = await publicEventsRes.json() as any;
    const recoveredEvent = publicData.events.find((e: any) => e.id === eventId);

    assert(Boolean(recoveredEvent), 'Event was recovered across server restart!');
    assert(recoveredEvent?.title === testEventTitle, 'Recovered event has correct title');
    assert(recoveredEvent?.status === 'approved', 'Recovered event maintained approved status');

    // Step 8: Delete Event on Server Instance #2
    const deleteRes = await fetch(`${BASE_URL}/api/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });
    assert(deleteRes.status === 200, 'DELETE /api/events/:id returned 200');

    // Check disk reflects deletion
    diskEvents = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
    assert(!diskEvents.some((e: any) => e.id === eventId), 'Deleted event removed from data/events.json on disk');

    console.log(`\nIntegration Results: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGKILL');
    }

    // Restore original files
    if (origEvents !== null) {
      fs.writeFileSync(EVENTS_FILE, origEvents, 'utf-8');
    } else if (fs.existsSync(EVENTS_FILE)) {
      fs.unlinkSync(EVENTS_FILE);
    }

    if (origNotifs !== null) {
      fs.writeFileSync(NOTIFS_FILE, origNotifs, 'utf-8');
    } else if (fs.existsSync(NOTIFS_FILE)) {
      fs.unlinkSync(NOTIFS_FILE);
    }
  }
}

runIntegration().catch((e) => {
  console.error('Integration test failed:', e);
  process.exit(1);
});
