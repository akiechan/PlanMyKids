/**
 * ICS calendar file generation for iOS/Android calendar export.
 * Generates .ics files that work with Apple Calendar, Google Calendar, Outlook, etc.
 */

interface CalendarProgram {
  name: string;
  provider_name?: string;
  registration_url?: string | null;
  new_registration_date?: string | null;
  re_enrollment_date?: string | null;
  scheduleDays?: string[];
  scheduleTimes?: { day: string; time: string; endTime?: string }[];
  sessionStartDate?: string | null;
  sessionEndDate?: string | null;
}

const DAY_ABBREV: Record<string, string> = {
  monday: 'MO',
  tuesday: 'TU',
  wednesday: 'WE',
  thursday: 'TH',
  friday: 'FR',
  saturday: 'SA',
  sunday: 'SU',
};

const DAY_JS_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}@planmykids.org`;
}

function formatDateAllDay(dateStr: string): string {
  // dateStr is YYYY-MM-DD → VALUE=DATE:YYYYMMDD
  return dateStr.replace(/-/g, '');
}

function formatDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    '00'
  );
}

function formatDateTimeUntil(dateStr: string): string {
  // YYYY-MM-DD → YYYYMMDD for UNTIL (all-day granularity)
  return dateStr.replace(/-/g, '') + 'T235959';
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function wrapICS(events: string): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PlanMyKids//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Generate a single calendar event for a registration date (Considering programs).
 */
export function generateRegistrationEvent(program: CalendarProgram): string | null {
  const regDate = program.new_registration_date;
  const reEnrollDate = program.re_enrollment_date;

  const events: string[] = [];

  if (regDate) {
    const desc = [
      program.provider_name ? `Provider: ${program.provider_name}` : '',
      program.registration_url ? `Register: ${program.registration_url}` : '',
    ]
      .filter(Boolean)
      .join('\\n');

    events.push(
      [
        'BEGIN:VEVENT',
        `UID:${uid()}`,
        `DTSTAMP:${formatDateTime(new Date())}`,
        `DTSTART;VALUE=DATE:${formatDateAllDay(regDate)}`,
        `DTEND;VALUE=DATE:${formatDateAllDay(regDate)}`,
        `SUMMARY:${escapeICS(`Registration: ${program.name}`)}`,
        desc ? `DESCRIPTION:${escapeICS(desc)}` : '',
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        `DESCRIPTION:Registration opens tomorrow for ${escapeICS(program.name)}`,
        'END:VALARM',
        'END:VEVENT',
      ]
        .filter(Boolean)
        .join('\r\n')
    );
  }

  if (reEnrollDate) {
    const desc = [
      program.provider_name ? `Provider: ${program.provider_name}` : '',
      program.registration_url ? `Register: ${program.registration_url}` : '',
    ]
      .filter(Boolean)
      .join('\\n');

    events.push(
      [
        'BEGIN:VEVENT',
        `UID:${uid()}`,
        `DTSTAMP:${formatDateTime(new Date())}`,
        `DTSTART;VALUE=DATE:${formatDateAllDay(reEnrollDate)}`,
        `DTEND;VALUE=DATE:${formatDateAllDay(reEnrollDate)}`,
        `SUMMARY:${escapeICS(`Re-enrollment: ${program.name}`)}`,
        desc ? `DESCRIPTION:${escapeICS(desc)}` : '',
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        `DESCRIPTION:Re-enrollment opens tomorrow for ${escapeICS(program.name)}`,
        'END:VALARM',
        'END:VEVENT',
      ]
        .filter(Boolean)
        .join('\r\n')
    );
  }

  if (events.length === 0) return null;
  return wrapICS(events.join('\r\n'));
}

/**
 * Find the next occurrence of a given weekday from a base date.
 */
function nextDayOccurrence(dayName: string, baseDate: Date): Date {
  const target = DAY_JS_INDEX[dayName.toLowerCase()];
  if (target === undefined) return baseDate;
  const result = new Date(baseDate);
  const current = result.getDay();
  const diff = (target - current + 7) % 7;
  result.setDate(result.getDate() + (diff === 0 ? 0 : diff));
  return result;
}

/**
 * Parse a time string like "09:00" or "9:00 AM" into hours and minutes.
 */
function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  // Handle HH:MM format
  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return { hours: parseInt(match24[1], 10), minutes: parseInt(match24[2], 10) };
  }
  // Handle 12-hour format like "9:00 AM"
  const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const ampm = match12[3].toUpperCase();
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
  }
  return null;
}

/**
 * Generate recurring calendar events for enrolled programs.
 */
export function generateRecurringEvents(program: CalendarProgram): string | null {
  const events: string[] = [];

  const baseDate = program.sessionStartDate
    ? new Date(program.sessionStartDate + 'T00:00:00')
    : new Date();

  // Prefer scheduleTimes (has day + time + optional endTime)
  if (program.scheduleTimes && program.scheduleTimes.length > 0) {
    for (const st of program.scheduleTimes) {
      const dayAbbrev = DAY_ABBREV[st.day.toLowerCase()];
      if (!dayAbbrev) continue;

      const startTime = parseTime(st.time);
      if (!startTime) continue;

      const endTime = st.endTime ? parseTime(st.endTime) : null;

      const eventDate = nextDayOccurrence(st.day, baseDate);
      const dtStart = new Date(eventDate);
      dtStart.setHours(startTime.hours, startTime.minutes, 0, 0);

      const dtEnd = new Date(eventDate);
      if (endTime) {
        dtEnd.setHours(endTime.hours, endTime.minutes, 0, 0);
      } else {
        dtEnd.setHours(startTime.hours + 1, startTime.minutes, 0, 0);
      }

      let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${dayAbbrev}`;
      if (program.sessionEndDate) {
        rrule += `;UNTIL=${formatDateTimeUntil(program.sessionEndDate)}`;
      }

      events.push(
        [
          'BEGIN:VEVENT',
          `UID:${uid()}`,
          `DTSTAMP:${formatDateTime(new Date())}`,
          `DTSTART:${formatDateTime(dtStart)}`,
          `DTEND:${formatDateTime(dtEnd)}`,
          rrule,
          `SUMMARY:${escapeICS(program.name)}`,
          program.provider_name
            ? `DESCRIPTION:${escapeICS(`Provider: ${program.provider_name}`)}`
            : '',
          'END:VEVENT',
        ]
          .filter(Boolean)
          .join('\r\n')
      );
    }
  }
  // Fallback: use scheduleDays (just day names, no specific times)
  else if (program.scheduleDays && program.scheduleDays.length > 0) {
    for (const day of program.scheduleDays) {
      const dayAbbrev = DAY_ABBREV[day.toLowerCase()];
      if (!dayAbbrev) continue;

      const eventDate = nextDayOccurrence(day, baseDate);
      // Default to 9:00 AM - 10:00 AM if no times available
      const dtStart = new Date(eventDate);
      dtStart.setHours(9, 0, 0, 0);
      const dtEnd = new Date(eventDate);
      dtEnd.setHours(10, 0, 0, 0);

      let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${dayAbbrev}`;
      if (program.sessionEndDate) {
        rrule += `;UNTIL=${formatDateTimeUntil(program.sessionEndDate)}`;
      }

      events.push(
        [
          'BEGIN:VEVENT',
          `UID:${uid()}`,
          `DTSTAMP:${formatDateTime(new Date())}`,
          `DTSTART:${formatDateTime(dtStart)}`,
          `DTEND:${formatDateTime(dtEnd)}`,
          rrule,
          `SUMMARY:${escapeICS(program.name)}`,
          program.provider_name
            ? `DESCRIPTION:${escapeICS(`Provider: ${program.provider_name}`)}`
            : '',
          'END:VEVENT',
        ]
          .filter(Boolean)
          .join('\r\n')
      );
    }
  }

  if (events.length === 0) return null;
  return wrapICS(events.join('\r\n'));
}

/**
 * Trigger a browser download of an .ics file.
 */
export function downloadICS(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
