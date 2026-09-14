import { CalendarEvent } from '../types';

/**
 * Clean and format dates for iCal (RFC 5545) and Web Calendar links
 */

function pad(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

function escapeIcsText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Parse YYYY-MM-DD and optional HH:MM into Date objects
 */
export function getEventDateTimes(event: CalendarEvent): {
  isAllDay: boolean;
  startDate: Date;
  endDate: Date;
  startDateStr: string; // YYYYMMDD
  endDateStr: string;   // YYYYMMDD
  startTimeUtcStr: string; // YYYYMMDDTHHMMSS
  endTimeUtcStr: string;   // YYYYMMDDTHHMMSS
} {
  const [yearStr, monthStr, dayStr] = event.date.split('-');
  const year = parseInt(yearStr, 10) || 2026;
  const month = parseInt(monthStr, 10) || 1;
  const day = parseInt(dayStr, 10) || 1;

  const [endYearStr, endMonthStr, endDayStr] = (event.endDate || event.date).split('-');
  const endYear = parseInt(endYearStr, 10) || year;
  const endMonth = parseInt(endMonthStr, 10) || month;
  const endDay = parseInt(endDayStr, 10) || day;

  const isAllDay = !event.startTime || (event.category === 'celebration' && !event.startTime);

  let startHours = 9;
  let startMins = 0;
  let endHours = 10;
  let endMins = 0;

  if (event.startTime) {
    const [h, m] = event.startTime.split(':').map((v) => parseInt(v, 10));
    if (!isNaN(h)) startHours = h;
    if (!isNaN(m)) startMins = m;
  }

  if (event.endTime) {
    const [h, m] = event.endTime.split(':').map((v) => parseInt(v, 10));
    if (!isNaN(h)) endHours = h;
    if (!isNaN(m)) endMins = m;
  } else {
    // default 1 hour duration
    endHours = (startHours + 1) % 24;
    endMins = startMins;
  }

  // If single-day and end is before or equal to start, ensure at least 1 hour duration
  const isSameDay = (!event.endDate || event.endDate === event.date);
  if (isSameDay && !isAllDay && (endHours < startHours || (endHours === startHours && endMins <= startMins))) {
    endHours = (startHours + 1) % 24;
    endMins = startMins;
  }

  const startDate = new Date(year, month - 1, day, startHours, startMins, 0);
  const endDate = new Date(endYear, endMonth - 1, endDay, endHours, endMins, 0);

  // Next day after last day for all-day DTEND in RFC 5545 (exclusive end date)
  const nextDayDate = new Date(endYear, endMonth - 1, endDay + 1);

  const startDateStr = `${year}${pad(month)}${pad(day)}`;
  const endDateStr = `${nextDayDate.getFullYear()}${pad(nextDayDate.getMonth() + 1)}${pad(nextDayDate.getDate())}`;

  const startTimeUtcStr = `${startDateStr}T${pad(startHours)}${pad(startMins)}00`;
  const endTimeUtcStr = `${endYear}${pad(endMonth)}${pad(endDay)}T${pad(endHours)}${pad(endMins)}00`;

  return {
    isAllDay,
    startDate,
    endDate,
    startDateStr,
    endDateStr,
    startTimeUtcStr,
    endTimeUtcStr,
  };
}

/**
 * Generate RFC 5545 valid .ics content string for a single CalendarEvent
 */
export function generateIcsContent(event: CalendarEvent): string {
  const { isAllDay, startDateStr, endDateStr, startTimeUtcStr, endTimeUtcStr } = getEventDateTimes(event);

  const now = new Date();
  const timestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const uid = `event-${event.id || 'new'}-${Date.now()}@sakkcommunity.calendar`;

  let description = event.description || '';
  if (event.submitterName) {
    description += `\n\nOrganizer: ${event.submitterName} (${event.submitterEmail || ''})`;
  }
  if (event.category) {
    description += `\nCategory: ${event.category}`;
  }
  if (event.expectedAttendees) {
    description += `\nExpected Attendees: ${event.expectedAttendees}`;
  }
  if (event.equipmentNeeds) {
    description += `\nEquipment / Logistics: ${event.equipmentNeeds}`;
  }

  const dtStartLine = isAllDay
    ? `DTSTART;VALUE=DATE:${startDateStr}`
    : `DTSTART:${startTimeUtcStr}`;

  const dtEndLine = isAllDay
    ? `DTEND;VALUE=DATE:${endDateStr}`
    : `DTEND:${endTimeUtcStr}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SAKK//Community Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${timestamp}`,
    dtStartLine,
    dtEndLine,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(event.location || '')}`,
    `CATEGORIES:${escapeIcsText(event.category || 'Event')}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

/**
 * Trigger client-side download of the .ics file
 */
export function downloadIcsFile(event: CalendarEvent, customFilename?: string): void {
  const icsData = generateIcsContent(event);
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const cleanTitle = (event.title || 'event')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const filename = customFilename || `${cleanTitle || 'calendar_event'}_${event.date}.ics`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 150);
}

/**
 * Generate Google Calendar Web URL
 */
export function getGoogleCalendarUrl(event: CalendarEvent): string {
  const { isAllDay, startDateStr, endDateStr, startTimeUtcStr, endTimeUtcStr } = getEventDateTimes(event);

  const datesParam = isAllDay
    ? `${startDateStr}/${endDateStr}`
    : `${startTimeUtcStr}/${endTimeUtcStr}`;

  let details = event.description || '';
  if (event.submitterName) {
    details += `\n\nOrganizer: ${event.submitterName} (${event.submitterEmail || ''})`;
  }
  if (event.category) {
    details += `\nCategory: ${event.category}`;
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: datesParam,
    details: details,
    location: event.location || '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate Outlook.com (Personal / Live) Web URL
 */
export function getOutlookLiveUrl(event: CalendarEvent): string {
  const { isAllDay, startDate, endDate } = getEventDateTimes(event);

  let body = event.description || '';
  if (event.submitterName) {
    body += `\n\nOrganizer: ${event.submitterName} (${event.submitterEmail || ''})`;
  }

  const startIso = isAllDay ? event.date : startDate.toISOString();
  const endIso = isAllDay ? (event.endDate || event.date) : endDate.toISOString();

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: startIso,
    enddt: endIso,
    allday: isAllDay ? 'true' : 'false',
    body: body,
    location: event.location || '',
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generate Microsoft 365 (Office / Work) Web URL
 */
export function getOffice365Url(event: CalendarEvent): string {
  const { isAllDay, startDate, endDate } = getEventDateTimes(event);

  let body = event.description || '';
  if (event.submitterName) {
    body += `\n\nOrganizer: ${event.submitterName} (${event.submitterEmail || ''})`;
  }

  const startIso = isAllDay ? event.date : startDate.toISOString();
  const endIso = isAllDay ? (event.endDate || event.date) : endDate.toISOString();

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: startIso,
    enddt: endIso,
    allday: isAllDay ? 'true' : 'false',
    body: body,
    location: event.location || '',
  });

  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generate Yahoo Calendar Web URL
 */
export function getYahooCalendarUrl(event: CalendarEvent): string {
  const { isAllDay, startDateStr, startTimeUtcStr, startDate, endDate } = getEventDateTimes(event);

  let durationStr = '0100';
  if (!isAllDay) {
    const diffMins = Math.max(15, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60)));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    durationStr = `${pad(hours)}${pad(mins)}`;
  }

  let desc = event.description || '';
  if (event.submitterName) {
    desc += `\nOrganizer: ${event.submitterName}`;
  }

  const params = new URLSearchParams({
    v: '60',
    view: 'd',
    type: '20',
    title: event.title,
    st: isAllDay ? startDateStr : startTimeUtcStr,
    dur: isAllDay ? '2400' : durationStr,
    desc: desc,
    in_loc: event.location || '',
  });

  return `https://calendar.yahoo.com/?${params.toString()}`;
}

/**
 * Generate RFC 5545 valid .ics content string for multiple CalendarEvents
 */
export function generateMultipleIcsContent(events: CalendarEvent[], calendarTitle = 'Community Events Calendar'): string {
  const now = new Date();
  const pad = (n: number) => n < 10 ? `0${n}` : `${n}`;
  const timestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const veventBlocks: string[] = [];

  for (const event of events) {
    const { isAllDay, startDateStr, endDateStr, startTimeUtcStr, endTimeUtcStr } = getEventDateTimes(event);
    const uid = `event-${event.id || Math.random().toString(36).substring(2)}-${Date.now()}@sakkcommunity.calendar`;

    let description = event.description || '';
    if (event.submitterName) {
      description += `\n\nOrganizer: ${event.submitterName} (${event.submitterEmail || ''})`;
    }
    if (event.category) {
      description += `\nCategory: ${event.category}`;
    }
    if (event.expectedAttendees) {
      description += `\nExpected Attendees: ${event.expectedAttendees}`;
    }
    if (event.equipmentNeeds) {
      description += `\nEquipment / Logistics: ${event.equipmentNeeds}`;
    }

    const dtStartLine = isAllDay
      ? `DTSTART;VALUE=DATE:${startDateStr}`
      : `DTSTART:${startTimeUtcStr}`;

    const dtEndLine = isAllDay
      ? `DTEND;VALUE=DATE:${endDateStr}`
      : `DTEND:${endTimeUtcStr}`;

    veventBlocks.push(
      [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${timestamp}`,
        dtStartLine,
        dtEndLine,
        `SUMMARY:${escapeIcsText(event.title)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        `LOCATION:${escapeIcsText(event.location || '')}`,
        `CATEGORIES:${escapeIcsText(event.category || 'Event')}`,
        'STATUS:CONFIRMED',
        'SEQUENCE:0',
        'END:VEVENT',
      ].join('\r\n')
    );
  }

  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SAKK//Community Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarTitle)}`,
  ].join('\r\n');

  return `${header}\r\n${veventBlocks.join('\r\n')}\r\nEND:VCALENDAR`;
}

/**
 * Trigger download of an .ics file containing multiple events
 */
export function downloadMultipleEventsIcs(events: CalendarEvent[], filename = 'events_calendar.ics', calendarTitle?: string): void {
  if (!events.length) return;
  const icsData = generateMultipleIcsContent(events, calendarTitle);
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.ics') ? filename : `${filename}.ics`);
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 150);
}

