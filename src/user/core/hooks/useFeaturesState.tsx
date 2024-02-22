import { ReactElement } from 'react';
import { RequestPhoneFeature } from '../features/requestPhone/RequestPhoneFeature';
import { RequestNameFeature } from '../features/requestName/RequestNameFeature';
import { FeatureAllStates } from '../models/FeatureAllStates';
import { SignupRewardFeature } from '../features/signupReward/SignupRewardFeature';
import { RequestNotificationTimeFeature } from '../features/requestNotificationTime/RequestNotificationTimeFeature';
import { VipChatRequestFeature } from '../features/vipChatRequest/VipChatRequestFeature';
import { PickEmotionJourneyFeature } from '../features/pickEmotionJourney/PickEmotionJourneyFeature';
import { GoalDaysPerWeekFeature } from '../features/goalDaysPerWeek/GoalDaysPerWeekFeature';
import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';
import { ValueWithCallbacks, WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { FavoritesFeature } from '../features/favorites/FavoritesFeature';
import { IsaiahCourseFeature } from '../features/isaiahCourse/IsaiahCourseFeature';
import { SettingsFeature } from '../features/settings/SettingsFeature';
import { TouchLinkFeature } from '../features/touchLink/TouchLinkFeature';
import { LoginFeature } from '../features/login/LoginFeature';
import { FastUnsubscribeFeature } from '../features/fastUnsubscribe/FastUnsubscribeFeature';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { useValuesWithCallbacksEffect } from '../../../shared/hooks/useValuesWithCallbacksEffect';
import { MergeAccountFeature } from '../features/mergeAccount/MergeAccountFeature';
import { ConfirmMergeAccountFeature } from '../features/confirmMergeAccount/ConfirmMergeAccountFeature';
import { ShareJourneyFeature } from '../features/shareJourney/ShareJourneyFeature';
import { SeriesListFeature } from '../features/seriesList/SeriesListFeature';

export const features = [
  TouchLinkFeature,
  ShareJourneyFeature,
  FastUnsubscribeFeature,
  LoginFeature,
  RequestNameFeature,
  ConfirmMergeAccountFeature,
  MergeAccountFeature,
  SignupRewardFeature,
  RequestPhoneFeature,
  RequestNotificationTimeFeature,
  VipChatRequestFeature,
  GoalDaysPerWeekFeature,
  IsaiahCourseFeature,
  FavoritesFeature,
  SeriesListFeature,
  SettingsFeature,
  PickEmotionJourneyFeature,
];

type UseFeaturesStateOptions = {
  /**
   * The maximum number of resources to load at once. The target number is the
   * smallest that ensures that there is no inter-screen loading time
   *
   * @default 3
   */
  maxSimultaneousLoadedResources?: number;

  /**
   * Enables debug logging to the given drain
   */
  debug?: {
    /**
     * Used to write a log message at the given level
     * @param level The level of the message
     * @param msg The message to log
     */
    log: (level: 'trace' | 'debug' | 'info' | 'warn' | 'critical', msg: string) => void;

    states: WritableValueWithCallbacks<any[]>;
    required: WritableValueWithCallbacks<(boolean | undefined)[]>;
    requiredRollingSum: WritableValueWithCallbacks<number[]>;
    loadingFeatures: WritableValueWithCallbacks<boolean[]>;
    resources: WritableValueWithCallbacks<any[]>;
    loadingResources: WritableValueWithCallbacks<boolean[]>;
  };
};

/**
 * Determines the current state of the various features the app supports. Once
 * we've determined what feature the user should see, then the required property
 * will be true and this state should be forwarded to the FeaturesRouter.
 *
 * Under normal circumstances a feature should always be found, however, if all of
 * them indicate they should not be shown then `loading` and `required` may both
 * be false.
 *
 * This never triggers react rerenders, though in practice the the returned component
 * needs to be rendered, which requires a rerender.
 * @returns The component to mount, undefined if we need more time to determine what to show,
 *   null if no feature wants to be shown.
 */
export const useFeaturesState = (
  opts?: UseFeaturesStateOptions
): ValueWithCallbacks<ReactElement | null | undefined> => {
  const realOpts: UseFeaturesStateOptions & { maxSimultaneousLoadedResources: number } =
    Object.assign({}, { maxSimultaneousLoadedResources: 3 }, opts);

  const states = features.map((s) => s.useWorldState());
  useValuesWithCallbacksEffect(states, () => {
    if (realOpts.debug) {
      realOpts.debug.states.set(states.map((s) => s.get()));
      realOpts.debug.states.callbacks.call(undefined);
    }
    return undefined;
  });

  if (realOpts.debug !== undefined) {
    realOpts.debug.log('trace', 'useFeaturesState executing');
    for (let i = 0; i < states.length; i++) {
      realOpts.debug.log(
        'trace',
        `  ${features[i].identifier}: ${JSON.stringify(states[i].get(), null, 2)}`
      );
    }
  }

  const allStates = useMappedValuesWithCallbacks(states, () => {
    const res: any = {};
    states.forEach((s, idx) => {
      const state = s.get();
      res[features[idx].identifier] = state;
    });
    return res as FeatureAllStates;
  });
  const required = features.map((f, i) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMappedValueWithCallbacks(allStates, (unw) => f.isRequired(states[i].get() as any, unw))
  );
  useValuesWithCallbacksEffect(required, () => {
    if (realOpts.debug) {
      realOpts.debug.required.set(required.map((r) => r.get()));
      realOpts.debug.required.callbacks.call(undefined);
    }
    return undefined;
  });

  const requiredRollingSum = useMappedValuesWithCallbacks(
    required,
    () => {
      const res: number[] = [];
      let sum = 0;
      for (let i = 0; i < required.length; i++) {
        sum += required[i].get() ? 1 : 0;
        res.push(sum);
      }
      return res;
    },
    {
      outputEqualityFn: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
    }
  );
  useValueWithCallbacksEffect(requiredRollingSum, () => {
    if (realOpts.debug) {
      realOpts.debug.requiredRollingSum.set(requiredRollingSum.get());
      realOpts.debug.requiredRollingSum.callbacks.call(undefined);
    }
    return undefined;
  });

  const loadingFeatures = features.map((f, featureIdx) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMappedValueWithCallbacks(requiredRollingSum, () => {
      return (
        !!required[featureIdx].get() &&
        requiredRollingSum.get()[featureIdx] <= realOpts.maxSimultaneousLoadedResources
      );
    })
  );
  useValuesWithCallbacksEffect(loadingFeatures, () => {
    if (realOpts.debug) {
      realOpts.debug.loadingFeatures.set(loadingFeatures.map((r) => r.get()));
      realOpts.debug.loadingFeatures.callbacks.call(undefined);
    }
    return undefined;
  });

  const resources = features.map((f, i) =>
    f.useResources(states[i] as any, loadingFeatures[i], allStates)
  );
  if (realOpts.debug !== undefined) {
    realOpts.debug.log('trace', 'useFeaturesState resources:');
    for (let i = 0; i < resources.length; i++) {
      realOpts.debug.log(
        'trace',
        `  ${features[i].identifier}: ${JSON.stringify(resources[i].get(), null, 2)}`
      );
    }
  }
  useValuesWithCallbacksEffect(resources, () => {
    if (realOpts.debug) {
      realOpts.debug.resources.set(resources.map((r) => r.get()));
      realOpts.debug.resources.callbacks.call(undefined);
    }
    return undefined;
  });

  const loadingResources = resources.map((res) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMappedValueWithCallbacks(res as ValueWithCallbacks<{ loading: boolean }>, (r) => r.loading)
  );
  useValuesWithCallbacksEffect(loadingResources, () => {
    if (realOpts.debug) {
      realOpts.debug.loadingResources.set(loadingResources.map((r) => r.get()));
      realOpts.debug.loadingResources.callbacks.call(undefined);
    }
    return undefined;
  });

  return useMappedValuesWithCallbacks([...required, ...loadingResources], () => {
    const req = required.map((r) => r.get());
    const loading = loadingResources.map((r) => r.get());
    for (let i = 0; i < req.length; i++) {
      if (req[i] === undefined) {
        realOpts.debug?.log(
          'info',
          `waiting on feature ${features[i].identifier} to decide if it is required`
        );
        return undefined;
      }

      if (req[i]) {
        if (loading[i]) {
          realOpts.debug?.log('info', `waiting on feature ${features[i].identifier} to load`);
          return undefined;
        }

        realOpts.debug?.log('info', `displaying ${features[i].identifier}`);
        return features[i].component(states[i] as any, resources[i] as any);
      }
    }

    realOpts.debug?.log('critical', 'no feature requested');
    console.log('no feature requested');
    return null;
  });
};
