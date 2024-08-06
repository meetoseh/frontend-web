import { CrudFetcherMapper, convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import { ExternalCourse, externalCourseKeyMap } from '../../../series/lib/ExternalCourse';
import {
  convertTriggerWithExit,
  ScreenTriggerWithExitAPI,
  ScreenTriggerWithExitMapped,
} from '../../lib/convertTriggerWithExit';

export type SeriesDetailsAPIParams = {
  series: { __mapped: false };

  /** entrance transition */
  entrance: StandardScreenTransition;

  // Docs are on mapped one, which we're more likely to hover
  buttons: {
    buy_now: ScreenTriggerWithExitAPI;
    back: ScreenTriggerWithExitAPI;
    take_class: ScreenTriggerWithExitAPI;
    rewatch_intro: ScreenTriggerWithExitAPI | null;
  };
};

export type SeriesDetailsMappedParams = Omit<SeriesDetailsAPIParams, 'series' | 'triggers'> & {
  /** The series to show the details of */
  series: ExternalCourse;
  /**
   * The slug of the flows to trigger based on what action the user performs.
   */
  buttons: {
    /**
     * If `hasEntitlement` is false on the course, a "Unlock with OSEH+" button
     * is shown, which when pressed pops the screen with this client flow slug
     */
    buyNow: ScreenTriggerWithExitMapped;

    /**
     * If the user presses the back button at the top left, this client flow
     * slug is triggered.
     */
    back: ScreenTriggerWithExitMapped;

    /**
     * If `hasEntitlement` is true on the course, tapping any of the classes
     * will use the `pop_to_series_class` endpoint with the client parameter
     * `{"series": {"uid": "string", "jwt": "string"}, "journey": {"uid": "string"}}`
     * which will ultimately trigger the client flow with this slug with the
     * server parameters `{"series": "string", "journey": "string"}`
     */
    takeClass: ScreenTriggerWithExitMapped;

    /**
     * If not null, a "Watch Introduction" button is shown below the
     * class list, which when pressed will trigger the corresponding
     * client flow with server parameters `{"series": "string"}`
     */
    rewatchIntro: ScreenTriggerWithExitMapped | null;
  };
  __mapped?: true;
};

export const seriesDetailsParamsMapper: CrudFetcherMapper<SeriesDetailsMappedParams> = {
  series: (_, v) => ({
    key: 'series',
    value: convertUsingMapper(v, externalCourseKeyMap),
  }),
  buttons: (_, v) => ({
    key: 'buttons',
    value: {
      buyNow: convertTriggerWithExit(v.buy_now),
      back: convertTriggerWithExit(v.back),
      takeClass: convertTriggerWithExit(v.take_class),
      rewatchIntro:
        v.rewatch_intro === null || v.rewatch_intro === undefined
          ? null
          : convertTriggerWithExit(v.rewatch_intro),
    },
  }),
};
