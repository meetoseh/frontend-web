import { CourseClassesState } from '../steps/courseClasses/CourseClassesState';
import { DailyGoalState } from '../steps/dailyGoal/DailyGoalState';
import { IntrospectionState } from '../steps/introspection/IntrospectionState';
import { OnboardingClassState } from '../steps/onboardingClass/OnboardingClassState';
import { PickEmotionJourneyState } from '../steps/pickEmotionJourney/PickEmotionJourneyState';
import { RequestNameState } from '../steps/requestName/RequestNameState';
import { RequestNotificationTimeState } from '../steps/requestNotificationTime/RequestNotificationTimeState';
import { RequestPhoneState } from '../steps/requestPhone/RequestPhoneState';
import { SignupRewardState } from '../steps/signupReward/SignupRewardState';
import { VipChatRequestState } from '../steps/vipChatRequest/VipChatRequestState';
import { YourJourneyState } from '../steps/yourJourney/YourJourneyState';

export type OnboardingAllStates = {
  courseClasses: CourseClassesState;
  requestName: RequestNameState;
  requestPhone: RequestPhoneState;
  signupReward: SignupRewardState;
  dailyGoal: DailyGoalState;
  onboardingClass: OnboardingClassState;
  introspection: IntrospectionState;
  requestNotificationTime: RequestNotificationTimeState;
  yourJourney: YourJourneyState;
  vipChatRequest: VipChatRequestState;
  pickEmotionJourney: PickEmotionJourneyState;
};
