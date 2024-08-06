import { CrudFetcherMapper } from '../../../../admin/crud/CrudFetcher';
import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  convertTriggerWithExit,
  ScreenTriggerWithExitAPI,
  ScreenTriggerWithExitMapped,
} from '../../lib/convertTriggerWithExit';
import {
  convertScreenConfigurableTriggerWithOldVersion,
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';

type SeriesListAPIParamsTooltip = {
  /** Header for the tooltip */
  header: string;

  /** Body of the tooltip */
  body: string;
};

type SeriesListAPIParamsCTA = {
  /** The text for the call to action */
  text: string;

  /** The trigger when the user clicks the button, with no parameters */
  trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
  triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
};

export type SeriesListMappedParamsTooltip = SeriesListAPIParamsTooltip;
export type SeriesListMappedParamsCTA = {
  /** The text for the call to action */
  text: string;
  /** The trigger when the user clicks the button, with no parameters */
  trigger: ScreenConfigurableTrigger;
};

export type SeriesListAPIParams = {
  /** The tooltip above the first series, if any */
  tooltip: SeriesListAPIParamsTooltip | null;

  /** The call to action, if any, displayed as a bottom button */
  cta: SeriesListAPIParamsCTA | null;

  /** If null, no bottom bar is displayed. Otherwise, configures the bottom bar */
  bottom: {
    /** For if the user taps the home button in the bottom bar */
    home: ScreenTriggerWithExitAPI;

    /** For if the user taps the account button in the bottom bar */
    account: ScreenTriggerWithExitAPI;
  } | null;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition for cta */
  exit: StandardScreenTransition;

  // Docs are on mapped one, which we're more likely to hover
  series_trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
  series_triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
};

export type SeriesListMappedParams = {
  /** The tooltip above the first series, if any */
  tooltip: SeriesListMappedParamsTooltip | null;

  /** The call to action, if any, displayed as a bottom button */
  cta: SeriesListMappedParamsCTA | null;

  /** If null, no bottom bar is displayed. Otherwise, configures the bottom bar */
  bottom: {
    /** For if the user taps the home button in the bottom bar */
    home: ScreenTriggerWithExitMapped;

    /** For if the user taps the account button in the bottom bar */
    account: ScreenTriggerWithExitMapped;
  } | null;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition for cta */
  exit: StandardScreenTransition;

  /**
   * The client flow slug to trigger when they tap a series. We trigger this flow, by default,
   * through the special endpoint `/api/1/users/me/screens/pop_to_series`, providing the
   * client parameters `{"series": {"uid": "string", "jwt": "string"}}`, which will
   * ultimately trigger the client flow with this slug with the server parameters `{"series": "string"}`
   */
  seriesTrigger: ScreenConfigurableTrigger;

  __mapped: true;
};

export const seriesListParamsMapper: CrudFetcherMapper<SeriesListMappedParams> = (raw) => {
  const api = raw as SeriesListAPIParams;
  return {
    tooltip: api.tooltip,
    cta:
      api.cta === null || api.cta === undefined
        ? null
        : {
            text: api.cta.text,
            trigger: convertScreenConfigurableTriggerWithOldVersion(
              api.cta.trigger,
              api.cta.triggerv75
            ),
          },
    bottom:
      api.bottom === null || api.bottom === undefined
        ? null
        : {
            home: convertTriggerWithExit(api.bottom.home),
            account: convertTriggerWithExit(api.bottom.account),
          },
    entrance: api.entrance,
    exit: api.exit,
    seriesTrigger: convertScreenConfigurableTriggerWithOldVersion(
      api.series_trigger,
      api.series_triggerv75
    ),
    __mapped: true,
  };
};
