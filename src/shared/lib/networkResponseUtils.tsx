import { ReactElement } from 'react';
import { ErrorBlock } from '../forms/ErrorBlock';
import {
  AdminDashboardLargeChart,
  AdminDashboardLargeChartProps,
} from '../../admin/dashboard/AdminDashboardLargeChart';
import { AdminDashboardLargeChartPlaceholder } from '../../admin/dashboard/AdminDashboardLargeChartPlaceholder';

type NetworkResponseFormatOptions = {
  /**
   * The placeholder to use if the value is null. By default, `null` is
   * interpreted to mean that we fetched the value but it's not applicable,
   * whereas `undefined` means that haven't finished fetching the value yet.
   */
  nullPlaceholder?: ReactElement;

  /**
   * The placeholder to use if the value is undefined. By default, `null` is
   * interpreted to mean that we fetched the value but it's not applicable,
   * whereas `undefined` means that haven't finished fetching the value yet.
   */
  undefinedPlaceholder?: ReactElement;
};

/**
 * Formats a value retrieved from the network, where by default null is
 * interpreted to mean that we fetched the value but it's not applicable,
 * undefined means that haven't finished fetching the value yet, and any other
 * value is interpreted as a valid value.
 *
 * @param value The value to format
 * @param formatter The formatter to use if the value is not null or undefined
 * @param opts Options to customize the formatting
 */
export function formatNetworkValue<T>(
  value: T | null | undefined,
  formatter: (v: T) => ReactElement,
  opts?: NetworkResponseFormatOptions
): ReactElement {
  if (value === null) {
    return opts?.nullPlaceholder ?? <>N/A</>;
  }

  if (value === undefined) {
    return opts?.undefinedPlaceholder ?? <>?</>;
  }

  return formatter(value);
}

/**
 * Formats a string received from the network as a fragment containing
 * that string
 *
 * @param str The string to format
 * @param opts Options to customize the formatting
 * @returns The formatted string
 * @see formatNetworkValue
 */
export function formatNetworkString(
  str: string | null | undefined,
  opts?: NetworkResponseFormatOptions
): ReactElement {
  return formatNetworkValue(str, (s) => <>{s}</>, opts);
}

/**
 * Formats the given number retrieved from the network. See `formatNetworkValue`
 *
 * @param num The number to format
 * @param opts Options to customize the formatting
 * @returns The formatted number
 */
export const formatNetworkNumber = (
  num: number | null | undefined,
  opts?: NetworkResponseFormatOptions
): ReactElement => formatNetworkValue(num, (n) => <>{n.toLocaleString()}</>);

/**
 * Formats the given date retrieved from the network. See `formatNetworkValue`
 *
 * @param date The date to format
 * @param opts Options to customize the formatting
 * @returns The formatted date
 */
export const formatNetworkDate = (
  date: Date | null | undefined,
  opts?: NetworkResponseFormatOptions
): ReactElement => formatNetworkValue(date, (d) => <>{d.toLocaleString()}</>);

/**
 * Formats a unix timestamp retrieved from the network as a date. See
 * `formatNetworkValue`
 *
 * @param timestamp The timestamp to format
 * @param opts Options to customize the formatting
 * @returns The formatted timestamp
 */
export const formatNetworkUnixTimestamp = (
  timestamp: number | null | undefined,
  opts?: NetworkResponseFormatOptions
): ReactElement => formatNetworkDate(timestamp ? new Date(timestamp * 1000) : null, opts);

export const formatNetworkUnixDate = (
  unixDate: number | null | undefined,
  opts?: NetworkResponseFormatOptions
): ReactElement => {
  if (unixDate === null || unixDate === undefined) {
    return formatNetworkValue(unixDate, () => <></>);
  }

  const midnightUTC = unixDate * 86400;
  const dateInUTC = new Date(midnightUTC * 1000);
  const year = dateInUTC.getUTCFullYear();
  const month = dateInUTC.getUTCMonth();
  const day = dateInUTC.getUTCDate();

  return formatNetworkString(new Date(year, month, day).toLocaleDateString());
};

/**
 * Formats the given duration in seconds in a human readable way. Typically
 * accessed via formatNetworkDuration.
 *
 * @param seconds The duration in seconds
 * @returns The formatted duration
 */
export const formatDuration = (seconds: number): ReactElement => {
  if (seconds < 2) {
    const ms = Math.round(seconds * 1000);
    return <>{ms}ms</>;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 2) {
    return <>{Math.round(seconds)}s</>;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 2) {
    const extraSeconds = Math.round(seconds - minutes * 60);
    return (
      <>
        {minutes}m {extraSeconds}s
      </>
    );
  }
  return (
    <>
      {hours}h {Math.round(minutes - hours * 60)}m
    </>
  );
};

/**
 * Formats the given duration in seconds from the network. See
 * `formatNetworkValue`
 *
 * @param seconds The duration in seconds
 * @param opts Options to customize the formatting
 * @returns The formatted duration
 */
export const formatNetworkDuration = (
  seconds: number | null | undefined,
  opts?: NetworkResponseFormatOptions
): ReactElement => formatNetworkValue(seconds, formatDuration);

/**
 * This breaks the standard conventions of `formatNetworkValue`; this displays
 * nothing if the error is null, otherwise wraps it an ErrorBlock.
 *
 * @param err The error to format
 * @returns The formatted error
 */
export const formatNetworkError = (err: ReactElement | null): ReactElement => (
  <>{err !== null && <ErrorBlock>{err}</ErrorBlock>}</>
);

/**
 * Formats a dashboard available from the network. By default, uses
 * a better placeholder for dashboards which will generally take up
 * the right amount of space, and allows for an `onVisible` callback
 * that can be used to decide to load the dashboard only once it
 * becomes visible.
 *
 * @param dashboard The dashboard to format
 * @param opts Options to customize the formatting, plus an `onVisible`
 *   callback which is called when the placeholder becomes visible
 * @returns The formatted dashboard
 */
export const formatNetworkDashboard = (
  dashboard: AdminDashboardLargeChartProps | null | undefined,
  opts?: NetworkResponseFormatOptions & {
    onVisible?: () => void;
  }
): ReactElement => (
  <>
    {dashboard === undefined &&
      (opts?.undefinedPlaceholder ?? (
        <AdminDashboardLargeChartPlaceholder onVisible={opts?.onVisible} />
      ))}
    {dashboard === null && opts?.nullPlaceholder}
    {dashboard !== undefined && dashboard !== null && <AdminDashboardLargeChart {...dashboard} />}
  </>
);
