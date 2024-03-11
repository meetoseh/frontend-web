import { JourneyLinkViewStatsComplete } from '../models/JourneyLinkViewStats';
import { NetworkResponse, useNetworkResponse } from '../../../shared/hooks/useNetworkResponse';
import { apiFetch } from '../../../shared/ApiConstants';
import { ValueWithCallbacks } from '../../../shared/lib/Callbacks';

/**
 * Fetches the journey link stats; this requires two requests (one for
 * historical, one for partial), but the provided interface simplifies the data
 * into a single object.
 *
 * Requires a login context
 */
export const useJourneyLinkViewStatsComplete = (): ValueWithCallbacks<
  NetworkResponse<JourneyLinkViewStatsComplete>
> => {
  return useNetworkResponse<JourneyLinkViewStatsComplete>(
    async (active, loginContext): Promise<JourneyLinkViewStatsComplete | null> => {
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const controller = window?.AbortController ? new AbortController() : undefined;
      const signal = controller?.signal;
      const doAbort = () => controller?.abort();
      active.callbacks.add(doAbort);

      if (!active.get()) {
        return null;
      }

      const [historicalRaw, partialRaw] = await Promise.all([
        apiFetch(
          '/api/1/admin/journey_share_links/journey_share_link_stats',
          { signal },
          loginContext
        ).then((response) => (response.ok ? response.json() : Promise.reject(response))),
        apiFetch(
          '/api/1/admin/journey_share_links/partial_journey_share_link_stats',
          { signal },
          loginContext
        ).then((response) => (response.ok ? response.json() : Promise.reject(response))),
      ]);

      if (!active.get()) {
        return null;
      }

      return {
        historical: historicalRaw,
        partial: partialRaw,
      };
    }
  );
};
