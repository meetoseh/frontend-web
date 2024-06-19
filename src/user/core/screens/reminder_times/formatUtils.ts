import { DayOfWeek } from '../../../../shared/models/DayOfWeek';
import { Channel } from './lib/Channel';

/**
 * Determines the appropriate display name for the given channel.
 */
export const nameForChannel = (channel: Channel, opts?: { capitalize?: boolean }): string => {
  if (channel === 'sms') {
    return 'SMS';
  }

  if (opts?.capitalize) {
    return channel[0].toUpperCase() + channel.slice(1);
  }

  return channel;
};

const printedDaysOfWeekOrder: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const shortestRepresentation: Record<DayOfWeek, string> = {
  Monday: 'M',
  Tuesday: 'Tu',
  Wednesday: 'W',
  Thursday: 'Th',
  Friday: 'F',
  Saturday: 'Sa',
  Sunday: 'Su',
};

/**
 * Pretty print a list of days of week
 */
export const makeDaysOfWeekPretty = (daysOfWeek: DayOfWeek[]): string => {
  if (daysOfWeek.length === 7) {
    return 'Every Day';
  }

  if (daysOfWeek.length === 5 && daysOfWeek.every((d) => d !== 'Saturday' && d !== 'Sunday')) {
    return 'Every Week Day';
  }

  if (daysOfWeek.length === 0) {
    return 'Never';
  }

  if (daysOfWeek.length === 1) {
    return daysOfWeek[0];
  }

  daysOfWeek = [...daysOfWeek].sort((a, b) => {
    return printedDaysOfWeekOrder.indexOf(a) - printedDaysOfWeekOrder.indexOf(b);
  });

  if (daysOfWeek.length === 2) {
    return `${daysOfWeek[0]} and ${daysOfWeek[1]}`;
  }

  if (daysOfWeek.length === 3) {
    return `${daysOfWeek[0].slice(0, 3)}, ${daysOfWeek[1].slice(0, 3)}, and ${daysOfWeek[2].slice(
      0,
      3
    )}`;
  }

  return daysOfWeek.map((d) => shortestRepresentation[d]).join(', ');
};

/**
 * Pretty print a time range specified by the number seconds from midnight
 */
export const makeTimeRangePretty = (start: number, end: number): string => {
  if (start === end) {
    return makeSecondsOffsetPretty(start);
  }

  return `${makeSecondsOffsetPretty(start)} - ${makeSecondsOffsetPretty(end)}`;
};

/**
 * Pretty prints the given number of seconds after midnight
 */
export const makeSecondsOffsetPretty = (seconds: number): string => {
  let h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 24) {
    h -= 24;
  }

  let ampm = 'AM';
  if (h > 12) {
    h -= 12;
    ampm = 'PM';
  }

  if (h === 0 && m === 0 && s === 0) {
    return 'midnight';
  }

  if (h === 12 && m === 0 && s === 0) {
    return 'noon';
  }

  const parts = [];
  if (h === 0) {
    parts.push('12');
  } else {
    parts.push(h.toString());
  }

  if (m !== 0 || s !== 0) {
    parts.push(':');
    parts.push(m.toString().padStart(2, '0'));

    if (s !== 0) {
      parts.push(':');
      parts.push(s.toString().padStart(2, '0'));
    }
  }
  parts.push(ampm);
  return parts.join('');
};
