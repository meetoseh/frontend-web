import { useCallback } from 'react';
import { NetworkResponse, useNetworkResponse } from '../hooks/useNetworkResponse';
import { adaptActiveVWCToAbortSignal } from '../lib/adaptActiveVWCToAbortSignal';
import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from './RenderGuardedComponent';
import { ValueWithCallbacks } from '../lib/Callbacks';

/**
 * Basic metadata about a language
 */
export type Language = {
  /** ISO639-1 Alpha-2 lowercase code */
  code: string;
  /** The name in english */
  name: string;
  /** The name in the language */
  native: string;
};

/**
 * Fetches the list of languages from the server
 */
export const useLanguagesNR = () =>
  useNetworkResponse<Language[]>(
    useCallback(
      (active) =>
        adaptActiveVWCToAbortSignal(active, async (signal) => {
          const response = await fetch('/languages.json', {
            method: 'GET',
            signal,
          });
          if (!response.ok) {
            throw response;
          }
          return await response.json();
        }),
      []
    )
  );

/**
 * Provides a list of <option> elements for the given languages, always
 * including the given forceInclude language code as an option, even if
 * it's not in the list.
 */
export const ISO639_1_Options = ({
  forceInclude,
  optionsNR,
}: {
  forceInclude: string;
  optionsNR: ValueWithCallbacks<NetworkResponse<Language[]>>;
}) => {
  const optionsVWC = useMappedValueWithCallbacks(optionsNR, (loaded) => {
    let opts =
      loaded.type !== 'success'
        ? [
            {
              code: 'en',
              name: 'English',
              native: 'English',
            },
            {
              code: 'es',
              name: 'Spanish',
              native: 'Español',
            },
          ]
        : loaded.result;

    if (!opts.some((o) => o.code === forceInclude)) {
      opts = [...opts];
      opts.push({
        code: forceInclude,
        name: 'Unknown',
        native: forceInclude,
      });
    }

    return opts;
  });

  return (
    <RenderGuardedComponent
      props={optionsVWC}
      component={(options) => (
        <>
          {options.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name} ({option.native})
            </option>
          ))}
        </>
      )}
    />
  );
};
