import { CourseClassesState } from '../steps/courseClasses/CourseClassesState';
import { GoalDaysPerWeekState } from '../steps/goalDaysPerWeek/GoalDaysPerWeekState';
import { PickEmotionJourneyState } from '../steps/pickEmotionJourney/PickEmotionJourneyState';
import { RequestNameState } from '../steps/requestName/RequestNameState';
import { RequestNotificationTimeState } from '../steps/requestNotificationTime/RequestNotificationTimeState';
import { RequestPhoneState } from '../steps/requestPhone/RequestPhoneState';
import { SignupRewardState } from '../steps/signupReward/SignupRewardState';
import { VipChatRequestState } from '../steps/vipChatRequest/VipChatRequestState';

export type OnboardingAllStates = {
  courseClasses: CourseClassesState;
  requestName: RequestNameState;
  requestPhone: RequestPhoneState;
  signupReward: SignupRewardState;
  requestNotificationTime: RequestNotificationTimeState;
  vipChatRequest: VipChatRequestState;
  pickEmotionJourney: PickEmotionJourneyState;
  goalDaysPerWeek: GoalDaysPerWeekState;
};
