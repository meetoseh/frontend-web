import { ReactElement, useCallback, useContext } from 'react';
import styles from './NetworkBlockStats.module.css';
import { useNetworkResponse } from '../../shared/hooks/useNetworkResponse';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { useUnwrappedValueWithCallbacks } from '../../shared/hooks/useUnwrappedValueWithCallbacks';
import { fromSnakeToTitleCase } from './fromSnakeToTitleCase';
import { IconButtonWithAutoDisable } from '../../shared/forms/IconButtonWithAutoDisable';
import { ErrorBlock } from '../../shared/forms/ErrorBlock';

export type NetworkBlockStatsItem = {
  /**
   * The key that identifies the item within the api response,
   * e.g., 'oldest_length_queued_at'
   */
  key: string;

  /**
   * If specified, the name for the item. Otherwise, the key
   * will be converted to title case and used as the name.
   */
  name?: string;

  /**
   * If specified, the description for the item. Otherwise, the
   * description will be omitted.
   */
  description?: string | ReactElement;

  /**
   * The function to use for formatting the value, usually
   * one of the exported functions from networkResponseUtils
   */
  format: (v: any | null | undefined) => ReactElement;
};

export type NetworkBlockStatsProps = {
  /**
   * The api path where the block stats can be loaded
   */
  path: string;

  /**
   * The items from the result to display
   */
  items: NetworkBlockStatsItem[];

  /**
   * Maps from special status codes in the response to the
   * component to render for that status code. If not
   * specified, the default error block will be used for
   * all status codes.
   */
  specialStatusCodes?: Record<number, () => ReactElement>;
};

/**
 * Loads and renders the block stats from the given path. For example,
 * if `path` points to an api route which returns
 *
 * ```json
 * {
 *   "length": 3,
 *   "oldest_length_queued_at": 1693920038.230
 * }
 * ```
 *
 * then the block stats can be rendered with
 *
 * ```tsx
 * <NetworkBlockStats path={path} items={useMemo(() => [
 *   { key: 'length', format: formatNetworkNumber },
 *   { key: 'oldest_length_queued_at', format: formatNetworkDate },
 * ], [])}
 * ```
 */
export const NetworkBlockStats = ({
  path,
  items,
  specialStatusCodes,
}: NetworkBlockStatsProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const data = useNetworkResponse<any | number>(
    useCallback(async () => {
      if (loginContext.state !== 'logged-in') {
        return undefined;
      }

      const response = await apiFetch(path, { method: 'GET' }, loginContext);
      if (specialStatusCodes !== undefined && specialStatusCodes.hasOwnProperty(response.status)) {
        return response.status;
      }

      if (!response.ok) {
        throw response;
      }
      return await response.json();
    }, [path, loginContext, specialStatusCodes])
  );

  const unwrappedDataError = useUnwrappedValueWithCallbacks(data.error, Object.is);
  const unwrappedDataResult = useUnwrappedValueWithCallbacks(data.result, Object.is);

  if (unwrappedDataError !== null) {
    return <ErrorBlock>{unwrappedDataError}</ErrorBlock>;
  }

  if (typeof unwrappedDataResult === 'number') {
    return specialStatusCodes?.[unwrappedDataResult]?.() ?? <ErrorBlock>Unknown error</ErrorBlock>;
  }

  return (
    <>
      {items.map((item, i) => {
        const value =
          unwrappedDataResult === undefined
            ? undefined
            : unwrappedDataResult === null
            ? null
            : (unwrappedDataResult as object).hasOwnProperty(item.key)
            ? unwrappedDataResult[item.key]
            : undefined;

        return (
          <div key={item.key} className={styles.blockStatistic}>
            <div className={styles.blockStatisticTitleRow}>
              <div className={styles.blockStatisticTitleAndValue}>
                <div className={styles.blockStatisticTitle}>
                  {item.name ?? fromSnakeToTitleCase(item.key)}
                </div>
                <div className={styles.blockStatisticValue}>{item.format(value)}</div>
              </div>
              {i === 0 && (
                <div className={styles.blockStatisticControls}>
                  <IconButtonWithAutoDisable
                    icon={styles.iconRefresh}
                    srOnlyName="refresh"
                    onClick={data.refresh}
                    spinWhileDisabled
                  />
                </div>
              )}
            </div>
            {item.description}
          </div>
        );
      })}
    </>
  );
};
