import { apiFetch } from '../../../shared/ApiConstants';
import { NetworkResponse, useNetworkResponse } from '../../../shared/hooks/useNetworkResponse';
import { ValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { convertUsingKeymap } from '../../crud/CrudFetcher';
import { TopSharers, topSharersKeyMap } from '../models/TopSharers';

/**
 * Loads the top sharers, including views from the given number of days (or
 * all time if undefined).
 */
export const useTopSharers = (days?: number): ValueWithCallbacks<NetworkResponse<TopSharers>> =>
  useNetworkResponse(async (active, loginContext) => {
    const controller = window?.AbortController ? new AbortController() : undefined;
    const signal = controller?.signal;
    if (controller) {
      active.callbacks.add(() => controller.abort());
    }

    if (!active.get()) {
      return null;
    }

    const response = await apiFetch(
      '/api/1/admin/journey_share_links/top_sharers',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          start_date: (() => {
            if (days === undefined) {
              return undefined;
            }

            const res = new Date(Date.now() - 1000 * 60 * 60 * 24 * (days + 2));
            return res.toISOString().split('T')[0];
          })(),
        }),
        signal,
      },
      loginContext
    );

    if (!response.ok) {
      throw response;
    }

    const raw = await response.json();
    return convertUsingKeymap(raw, topSharersKeyMap);
  });
