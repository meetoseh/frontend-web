import { CrudFetcherMapper, convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import { ExternalCourse, externalCourseKeyMap } from '../../../series/lib/ExternalCourse';

export type SeriesDetailsAPIParams = {
  series: { __mapped: false };

  /** entrance transition */
  entrance: StandardScreenTransition;

  // Docs are on mapped one, which we're more likely to hover
  buttons: {
    buy_now: {
      exit: StandardScreenTransition;
      trigger: string | null;
    };
    back: {
      exit: StandardScreenTransition;
      trigger: string | null;
    };
    take_class: {
      exit: StandardScreenTransition;
      trigger: string | null;
    };
    rewatch_intro: {
      exit: StandardScreenTransition;
      trigger: string | null;
    } | null;
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
    buyNow: {
      exit: StandardScreenTransition;
      trigger: string | null;
    };

    /**
     * If the user presses the back button at the top left, this client flow
     * slug is triggered.
     */
    back: {
      exit: StandardScreenTransition;
      trigger: string | null;
    };

    /**
     * If `hasEntitlement` is true on the course, tapping any of the classes
     * will use the `pop_to_series_class` endpoint with the client parameter
     * `{"series": {"uid": "string", "jwt": "string"}, "journey": {"uid": "string"}}`
     * which will ultimately trigger the client flow with this slug with the
     * server parameters `{"series": "string", "journey": "string"}`
     */
    takeClass: {
      exit: StandardScreenTransition;
      trigger: string | null;
    };

    /**
     * If not null, a "Watch Introduction" button is shown below the
     * class list, which when pressed will trigger the corresponding
     * client flow with server parameters `{"series": "string"}`
     */
    rewatchIntro: {
      exit: StandardScreenTransition;
      trigger: string | null;
    } | null;
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
      buyNow: v.buy_now,
      back: v.back,
      takeClass: v.take_class,
      rewatchIntro: v.rewatch_intro ?? null,
    },
  }),
};
