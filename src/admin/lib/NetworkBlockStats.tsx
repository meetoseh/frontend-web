import { ReactElement, useCallback } from 'react';
import styles from './NetworkBlockStats.module.css';
import { useNetworkResponse } from '../../shared/hooks/useNetworkResponse';
import { apiFetch } from '../../shared/ApiConstants';
import { useUnwrappedValueWithCallbacks } from '../../shared/hooks/useUnwrappedValueWithCallbacks';
import { fromSnakeToTitleCase } from './fromSnakeToTitleCase';
import { IconButton } from '../../shared/forms/IconButton';
import { BoxError, chooseErrorFromStatus } from '../../shared/lib/errors';

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
  const data = useNetworkResponse<any | number>(
    useCallback(
      async (active, loginContext) => {
        const response = await apiFetch(path, { method: 'GET' }, loginContext);
        if (
          specialStatusCodes !== undefined &&
          specialStatusCodes.hasOwnProperty(response.status)
        ) {
          return response.status;
        }

        if (!response.ok) {
          throw response;
        }
        return await response.json();
      },
      [path, specialStatusCodes]
    )
  );

  const unwrappedData = useUnwrappedValueWithCallbacks(data, Object.is);

  if (unwrappedData.error !== null) {
    return <BoxError error={unwrappedData.error} />;
  }

  if (typeof unwrappedData.result === 'number') {
    return (
      specialStatusCodes?.[unwrappedData.result]?.() ?? (
        <BoxError error={chooseErrorFromStatus(unwrappedData.result, 'load block stats')} />
      )
    );
  }

  return (
    <>
      {items.map((item, i) => {
        const value =
          unwrappedData.result === undefined
            ? undefined
            : unwrappedData.result === null
            ? null
            : (unwrappedData.result as object).hasOwnProperty(item.key)
            ? unwrappedData.result[item.key]
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
                  <IconButton
                    icon={styles.iconRefresh}
                    srOnlyName="refresh"
                    onClick={(e) => {
                      e.preventDefault();
                      data.get().refresh?.();
                    }}
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
