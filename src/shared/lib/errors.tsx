import { ReactElement } from 'react';
import { HorizontalSpacer } from '../components/HorizontalSpacer';
import { VerticalSpacer } from '../components/VerticalSpacer';
import { OsehColors } from '../OsehColors';
import { OsehStyles } from '../OsehStyles';
import { combineClasses } from './combineClasses';
import { Close } from '../components/icons/Close';
import { RenderGuardedComponent } from '../components/RenderGuardedComponent';
import { setVWC } from './setVWC';
import { WritableValueWithCallbacks } from './Callbacks';

/**
 * The classification of the the type of error that occurred.
 *
 * - `connectivity`: We are not able to communicate with the backend servers.
 *   Typically, this is because the user is offline, but can also occur from
 *   CORS issues. Generally, this occurs when fetch() rejects or the response json()
 *   rejects, and we exhausted all retries.
 * - `server-refresh-required`: One of our authentication mechanisms has expired
 *   (e.g., our id token). This type of error can always be recovered from
 *   automatically if the client supported doing so, but given it can occur in
 *   so many situations it often makes sense to not support it. The user can
 *   resolve it themselves by reloading the page (on web) or killing and
 *   restarting the app (on mobile).
 * - `server-ratelimited`: The server told us to back off, but we exhausted all
 *   retries
 * - `server-retryable`: We received a retryable error response (e.g., 503), but
 *   exhausted all retries
 * - `server-not-retryable`: We received a non-retryable error response (e.g., 400).
 *   Typically this will require a client update or server update to resolve, so
 *   there is no point in retrying.
 * - `client`: There is a bug either in the server or the client. For example, we
 *   expect to receive `{"foo": "text"}` but instead received `{"foo": 5}`, or an
 *   error was raised while we were executing, or some other invariant didn't hold.
 *   This error will probably not be solved by retrying, is likely repeatable, and
 *   may be resolvable by the user by taking a different action.
 * - `canceled`: If the user actually sees this error it's just like client. Normally,
 *   this is just a value filled into an error object that isn't shown to the user because
 *   we are cleaning up an operation that was canceled.
 */
export type DisplayableErrorType =
  | 'connectivity'
  | 'server-refresh-required'
  | 'server-ratelimited'
  | 'server-retryable'
  | 'server-not-retryable'
  | 'client'
  | 'canceled';

const ERROR_TYPE_TO_MESSAGE: Record<DisplayableErrorType, { code: string; msg: string }> = {
  connectivity: { code: 'ECONN', msg: 'Could not connect to the server' },
  'server-refresh-required': { code: 'EREF', msg: 'Session expired' },
  'server-ratelimited': { code: 'ERATE', msg: 'Too many requests recently' },
  'server-retryable': { code: 'ERETRY', msg: 'Request failed too many times' },
  'server-not-retryable': { code: 'EFAIL', msg: 'Request failed' },
  client: { code: 'ECLIENT', msg: 'Something went wrong' },
  canceled: { code: 'ECANCEL', msg: 'Operation canceled' },
};

const contactSupport = { cta: 'Contact support', handler: 'mailto:hi@oseh.com' };
const ERROR_TYPE_TO_ACTION: Record<
  DisplayableErrorType,
  { cta: string; handler?: string | (() => void) }
> = {
  connectivity: { cta: 'Check your internet connection' },
  'server-refresh-required': { cta: 'Refresh the page', handler: () => window.location.reload() },
  'server-ratelimited': contactSupport,
  'server-retryable': contactSupport,
  'server-not-retryable': contactSupport,
  client: contactSupport,
  canceled: contactSupport,
};

/**
 * Describes an error that can be displayed to the user. This is a class
 * primarily so an `unknown` type can be quickly converted to this via
 * a single instanceof check, rather than just a type.
 */
export class DisplayableError {
  /** Broadly classifies what went wrong. See the type docs */
  type: DisplayableErrorType;

  /** What you were trying to do, e.g., "Save response" */
  action: string;

  /**
   * Additional details describing what went wrong as should be shown the the user
   * without a call to action.
   */
  details: string | undefined;

  constructor(type: DisplayableErrorType, action: string, details?: string) {
    this.type = type;
    this.action = action;
    this.details = details;
  }

  /**
   * Formats the problem that occurred as a string, combining the type
   * and details. This does not include the call to action.
   *
   * Example: "ECONN (store response): Could not connect to the serverfetch failed"
   */
  formatProblem(): string {
    const eType = ERROR_TYPE_TO_MESSAGE[this.type] ?? { code: 'EUNK', msg: 'Unknown error' };
    const root = `${eType.code} (${this.action}): ${eType.msg}`;
    return this.details ? `${root}—${this.details}` : `${root}.`;
  }

  /**
   * Creates the call to action that should be displayed to the user.
   * This either gives a call to action that should be displayed as
   * a button and call the given handler (or be an anchor link that
   * goes to the given handler on web if the handler is a string),
   * or just be text after the problem (if handler is undefined)
   */
  prepareCTA(): { cta: string; handler?: string | (() => void) } {
    return ERROR_TYPE_TO_ACTION[this.type];
  }
}

export const chooseErrorFromStatus = (status: number, action: string): DisplayableError => {
  if (status === 429) {
    return new DisplayableError('server-ratelimited', action);
  }

  if (status >= 500) {
    return new DisplayableError('server-retryable', action, `${status}`);
  }

  return new DisplayableError('server-not-retryable', action, `${status}`);
};

/**
 * Renders the given error via white text on a red box with the call-to-action
 * on the right. This is expected to be rendered within a flex column with
 * align-items stretch.
 *
 * If an on dismiss callback is set, a dismiss button will be shown on the right
 */
export const BoxError = ({
  error,
  onDismiss,
}: {
  error: DisplayableError;
  onDismiss?: () => void;
}): ReactElement => {
  const cta = error.prepareCTA();
  return (
    <div className={OsehStyles.layout.column} style={{ backgroundColor: OsehColors.v4.other.red }}>
      <div className={OsehStyles.layout.row}>
        <HorizontalSpacer width={16} />
        <VerticalSpacer height={40} />
        <div
          className={combineClasses(
            OsehStyles.typography.body,
            OsehStyles.colors.v4.primary.light
          )}>
          {error.formatProblem()}
          {cta.handler === undefined ? ` ${cta.cta}` : ''}
        </div>
        <HorizontalSpacer width={4} flexGrow={1} />
        {cta.handler !== undefined &&
          (typeof cta.handler === 'string' ? (
            <a
              href={cta.handler}
              className={combineClasses(
                OsehStyles.typography.body,
                OsehStyles.colors.v4.primary.white
              )}
              style={{ textDecoration: 'underline' }}>
              {cta.cta}
            </a>
          ) : (
            <button
              type="button"
              className={OsehStyles.unstyling.buttonAsColumn}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (cta.handler !== undefined && typeof cta.handler !== 'string') {
                  cta.handler();
                }
              }}>
              <div
                className={OsehStyles.layout.column}
                style={{
                  border: `1px solid ${OsehColors.v4.primary.white}`,
                  borderRadius: '4px',
                  padding: '4px 8px',
                }}>
                <div
                  className={combineClasses(
                    OsehStyles.typography.detail1,
                    OsehStyles.colors.v4.primary.white
                  )}>
                  {cta.cta}
                </div>
              </div>
            </button>
          ))}
        {onDismiss !== undefined ? (
          <>
            {cta.handler !== undefined && <HorizontalSpacer width={16} />}
            <button
              type="button"
              className={OsehStyles.unstyling.buttonAsColumn}
              onClick={((h) => {
                return (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  h();
                };
              })(onDismiss)}>
              <Close
                icon={{ height: 20 }}
                container={{ width: 40, height: 40 }}
                color={OsehColors.v4.primary.light}
                startPadding={{ x: { fixed: 4 }, y: { fraction: 0.5 } }}
              />
            </button>
          </>
        ) : (
          <HorizontalSpacer width={16} />
        )}
      </div>
    </div>
  );
};

/**
 * A wrapper around BoxError for the simple case where you want to set the writable
 * value with callbacks to null on dismiss
 */
export const SimpleDismissBoxError = ({
  error: errorVWC,
}: {
  error: WritableValueWithCallbacks<DisplayableError | null>;
}): ReactElement => (
  <RenderGuardedComponent
    props={errorVWC}
    component={(e) =>
      e === null ? <></> : <BoxError error={e} onDismiss={() => setVWC(errorVWC, null)} />
    }
  />
);

/**
 * Renders the given error like box error, but positioned absolutely to the top of
 * the most recent ancestor with `position: relative`
 */
export const ModalBoxError = ({
  error,
  onDismiss,
}: {
  error: DisplayableError;
  onDismiss?: () => void;
}): ReactElement => {
  return (
    <div
      className={OsehStyles.layout.column}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
      }}>
      <BoxError error={error} onDismiss={onDismiss} />
    </div>
  );
};

/**
 * A wrapper around ModalBoxError for the simple case where you want to set the writable
 * value with callbacks to null on dismiss
 */
export const SimpleDismissModalBoxError = ({
  error: errorVWC,
}: {
  error: WritableValueWithCallbacks<DisplayableError | null>;
}): ReactElement => (
  <RenderGuardedComponent
    props={errorVWC}
    component={(e) =>
      e === null ? <></> : <ModalBoxError error={e} onDismiss={() => setVWC(errorVWC, null)} />
    }
  />
);
