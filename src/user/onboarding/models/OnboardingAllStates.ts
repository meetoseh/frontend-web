import { DailyGoalState } from '../steps/dailyGoal/DailyGoalState';
import { IntrospectionState } from '../steps/introspection/IntrospectionState';
import { OnboardingClassState } from '../steps/onboardingClass/OnboardingClassState';
import { RequestNameState } from '../steps/requestName/RequestNameState';
import { RequestNotificationTimeState } from '../steps/requestNotificationTime/RequestNotificationTimeState';
import { RequestPhoneState } from '../steps/requestPhone/RequestPhoneState';
import { SignupRewardState } from '../steps/signupReward/SignupRewardState';
import { YourJourneyState } from '../steps/yourJourney/YourJourneyState';

export type OnboardingAllStates = {
  requestName: RequestNameState;
  requestPhone: RequestPhoneState;
  signupReward: SignupRewardState;
  dailyGoal: DailyGoalState;
  onboardingClass: OnboardingClassState;
  introspection: IntrospectionState;
  requestNotificationTime: RequestNotificationTimeState;
  yourJourney: YourJourneyState;
};
