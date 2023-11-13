import { ReactElement } from 'react';
import {
  DailyReminderSettingsLog,
  DailyReminderTimeRange,
  DayOfWeek,
} from './DailyReminderSettingsLog';
import { CrudItemBlock } from '../../../crud/CrudItemBlock';
import { CrudFormElement } from '../../../crud/CrudFormElement';

/**
 * Shows a single contact method log entry
 */
export const DailyReminderSettingsLogBlock = ({
  log,
}: {
  log: DailyReminderSettingsLog;
}): ReactElement => {
  return (
    <CrudItemBlock title={`Update ${log.channel}`} controls={null}>
      <CrudFormElement title="Days of Week">{makeDaysOfWeekPretty(log.daysOfWeek)}</CrudFormElement>
      <CrudFormElement title="Time Range">{makeTimeRangePretty(log.timeRange)}</CrudFormElement>
      <CrudFormElement title="Reason">
        <pre>{JSON.stringify(log.reason, null, 2)}</pre>
      </CrudFormElement>
      <CrudFormElement title="Timestamp">{log.createdAt.toLocaleString()}</CrudFormElement>
    </CrudItemBlock>
  );
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

/** Pretty print a list of days of week for admin area */
export const makeDaysOfWeekPretty = (daysOfWeek: DayOfWeek[]): ReactElement => {
  if (daysOfWeek.length === 7) {
    return <>Every Day</>;
  }

  if (daysOfWeek.length === 5 && daysOfWeek.every((d) => d !== 'Saturday' && d !== 'Sunday')) {
    return <>Every Week Day</>;
  }

  if (daysOfWeek.length === 0) {
    return <>Never</>;
  }

  if (daysOfWeek.length === 1) {
    return <>{daysOfWeek[0]}</>;
  }

  daysOfWeek = [...daysOfWeek].sort((a, b) => {
    return printedDaysOfWeekOrder.indexOf(a) - printedDaysOfWeekOrder.indexOf(b);
  });

  if (daysOfWeek.length === 2) {
    return (
      <>
        {daysOfWeek[0]} and {daysOfWeek[1]}
      </>
    );
  }

  if (daysOfWeek.length === 3) {
    return (
      <>
        {daysOfWeek[0].slice(0, 3)}, {daysOfWeek[1].slice(0, 3)}, and {daysOfWeek[2].slice(0, 3)}
      </>
    );
  }

  let parts = [];
  for (let i = 0; i < daysOfWeek.length; i++) {
    if (i !== 0) {
      parts.push(', ');
    }

    if (daysOfWeek[i] === 'Monday') {
      parts.push('M');
    } else if (daysOfWeek[i] === 'Tuesday') {
      parts.push('Tu');
    } else if (daysOfWeek[i] === 'Wednesday') {
      parts.push('W');
    } else if (daysOfWeek[i] === 'Thursday') {
      parts.push('Th');
    } else if (daysOfWeek[i] === 'Friday') {
      parts.push('F');
    } else if (daysOfWeek[i] === 'Saturday') {
      parts.push('Sa');
    } else if (daysOfWeek[i] === 'Sunday') {
      parts.push('Su');
    } else {
      parts.push(daysOfWeek[i]);
    }
  }

  return <>{parts.join('')}</>;
};

/** Pretty print a reminder time range for admin area */
export const makeTimeRangePretty = (timeRange: DailyReminderTimeRange): ReactElement => {
  if (timeRange.type === 'preset') {
    return <>{timeRange.preset}</>;
  }

  if (timeRange.start === timeRange.end) {
    return <>{makeSecondsOffsetPretty(timeRange.start)}</>;
  }

  return (
    <>
      {makeSecondsOffsetPretty(timeRange.start)} - {makeSecondsOffsetPretty(timeRange.end)}
    </>
  );
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
