import { CrudFetcherMapper } from '../../../../admin/crud/CrudFetcher';
import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';

export type SeriesListAPIParamsTooltip = {
  /** Header for the tooltip */
  header: string;

  /** Body of the tooltip */
  body: string;
};

export type SeriesListAPIParamsCTA = {
  /** The text for the call to action */
  text: string;

  /** The trigger when the user clicks the button, with no parameters */
  trigger: string | null;
};

export type SeriesListAPIParams = {
  /** The tooltip above the first series, if any */
  tooltip: SeriesListAPIParamsTooltip | null;

  /** The call to action, if any, displayed as a bottom button */
  cta: SeriesListAPIParamsCTA | null;

  /** If null, no bottom bar is displayed. Otherwise, configures the bottom bar */
  bottom: {
    /** For if the user taps the home button in the bottom bar */
    home: {
      /** The trigger with no parameters */
      trigger: string | null;
      /** The exit transition to use */
      exit: StandardScreenTransition;
    };

    /** For if the user taps the account button in the bottom bar */
    account: {
      /** The trigger with no parameters */
      trigger: string | null;
      /** The exit transition to use */
      exit: StandardScreenTransition;
    };
  } | null;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition for cta */
  exit: StandardScreenTransition;

  // Docs are on mapped one, which we're more likely to hover
  series_trigger: string | null;
};

export type SeriesListMappedParams = Omit<SeriesListAPIParams, 'series_trigger'> & {
  /**
   * The client flow slug to trigger when they tap a series. We trigger this flow
   * through the special endpoint `/api/1/users/me/screens/pop_to_series`, providing the
   * client parameters `{"series": {"uid": "string", "jwt": "string"}}`, which will
   * ultimately trigger the client flow with this slug with the server parameters `{"series": "string"}`
   */
  seriesTrigger: string | null;

  __mapped?: true;
};

export const seriesListParamsMapper: CrudFetcherMapper<SeriesListMappedParams> = {
  series_trigger: 'seriesTrigger',
};
