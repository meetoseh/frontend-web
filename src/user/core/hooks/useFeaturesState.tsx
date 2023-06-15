import { ReactElement, useMemo, useRef } from 'react';
import { RequestPhoneFeature } from '../features/requestPhone/RequestPhoneFeature';
import { RequestNameFeature } from '../features/requestName/RequestNameFeature';
import { FeatureAllStates } from '../models/FeatureAllStates';
import { SignupRewardFeature } from '../features/signupReward/SignupRewardFeature';
import { RequestNotificationTimeFeature } from '../features/requestNotificationTime/RequestNotificationTimeFeature';
import { VipChatRequestFeature } from '../features/vipChatRequest/VipChatRequestFeature';
import { CourseClassesFeature } from '../features/courseClasses/CourseClassesFeature';
import { PickEmotionJourneyFeature } from '../features/pickEmotionJourney/PickEmotionJourneyFeature';
import { GoalDaysPerWeekFeature } from '../features/goalDaysPerWeek/GoalDaysPerWeekFeature';
import { TryAIJourneyFeature } from '../features/tryAIJourney/TryAIJourneyFeature';
import { FeedbackAnnouncementFeature } from '../features/feedbackAnnouncement/FeedbackAnnouncementFeature';

export type FeaturesState = {
  /**
   * True if we're waiting for more information to determine the
   * feature states, false otherwise.
   */
  loading: boolean;

  /**
   * True if a feature is ready to be shown, false otherwise.
   */
  required: boolean;

  /**
   * The step to render, or null if no step should be rendered.
   */
  feature: ReactElement | null;
};

const features = [
  RequestNameFeature,
  FeedbackAnnouncementFeature,
  CourseClassesFeature,
  SignupRewardFeature,
  RequestPhoneFeature,
  RequestNotificationTimeFeature,
  VipChatRequestFeature,
  GoalDaysPerWeekFeature,
  TryAIJourneyFeature,
  PickEmotionJourneyFeature,
];

/**
 * Determines the current state of the various features the app supports. Once
 * we've determined what feature the user should see, then the required property
 * will be true and this state should be forwarded to the FeaturesRouter.
 *
 * Under normal circumstances a feature should always be found, however, if all of
 * them indicate they should not be shown then `loading` and `required` may both
 * be false.
 */
export const useFeaturesState = (): FeaturesState => {
  const states = features.map((s) => s.useWorldState());
  const allStates = useMemo(() => {
    const result = {} as any;
    for (let i = 0; i < features.length; i++) {
      result[features[i].identifier] = states[i];
    }
    return result as FeatureAllStates;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, states);
  const requiredArr = features.map((s, idx) => s.isRequired(states[idx] as any, allStates));
  const resources = features.map((s, idx) =>
    s.useResources(states[idx] as any, requiredArr[idx] ?? false, allStates)
  );

  const firstRequiredIdx = requiredArr.findIndex((r) => r);
  const loading =
    (firstRequiredIdx === -1 && requiredArr.some((r) => r === undefined)) ||
    requiredArr.slice(0, firstRequiredIdx).some((r) => r === undefined) ||
    (firstRequiredIdx >= 0 && resources[firstRequiredIdx]?.loading !== false);
  const firstRequired =
    firstRequiredIdx < 0
      ? undefined
      : {
          feature: features[firstRequiredIdx],
          state: states[firstRequiredIdx],
          resources: resources[firstRequiredIdx],
        };

  const resourcesRef = useRef(resources);
  resourcesRef.current = resources;

  const feature = useMemo<ReactElement | null>(() => {
    if (firstRequired?.feature === undefined || loading) {
      return null;
    }

    return (firstRequired.feature.component as any).call(
      undefined,
      firstRequired.state,
      firstRequired.resources,
      (worldState: any, pending: Promise<void>) => {
        const newAllStates = (() => {
          const result = {} as any;
          for (const [key, value] of Object.entries(allStates)) {
            if (key === firstRequired?.feature.identifier) {
              result[key] = worldState;
            } else {
              result[key] = value;
            }
          }
          return result as FeatureAllStates;
        })();

        const newRequiredArr = features.map((s, idx) =>
          s.isRequired(newAllStates[s.identifier] as any, newAllStates)
        );

        const newFirstRequiredIdx = newRequiredArr.findIndex((r) => r);
        if (newFirstRequiredIdx < 0) {
          return;
        }

        if (newRequiredArr.slice(0, newFirstRequiredIdx).some((r) => r === undefined)) {
          return;
        }

        if (features[newFirstRequiredIdx].identifier === firstRequired?.feature.identifier) {
          return;
        }

        (features[newFirstRequiredIdx].onMountingSoon as any)?.call(
          undefined,
          newAllStates[features[newFirstRequiredIdx].identifier],
          resourcesRef.current[newFirstRequiredIdx],
          pending,
          newAllStates
        );
      }
    );
  }, [loading, firstRequired?.feature, firstRequired?.state, firstRequired?.resources, allStates]);

  return useMemo<FeaturesState>(
    () => ({
      loading,
      required: firstRequiredIdx >= 0,
      feature,
    }),
    [loading, firstRequiredIdx, feature]
  );
};
