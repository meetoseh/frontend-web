import { CourseClassesState } from '../features/courseClasses/CourseClassesState';
import { FeedbackAnnouncementState } from '../features/feedbackAnnouncement/FeedbackAnnouncementState';
import { GoalDaysPerWeekState } from '../features/goalDaysPerWeek/GoalDaysPerWeekState';
import { PickEmotionJourneyState } from '../features/pickEmotionJourney/PickEmotionJourneyState';
import { RequestNameState } from '../features/requestName/RequestNameState';
import { RequestNotificationTimeState } from '../features/requestNotificationTime/RequestNotificationTimeState';
import { RequestPhoneState } from '../features/requestPhone/RequestPhoneState';
import { SignupRewardState } from '../features/signupReward/SignupRewardState';
import { TryAIJourneyState } from '../features/tryAIJourney/TryAIJourneyState';
import { VipChatRequestState } from '../features/vipChatRequest/VipChatRequestState';

export type FeatureAllStates = {
  courseClasses: CourseClassesState;
  feedbackAnnouncement: FeedbackAnnouncementState;
  requestName: RequestNameState;
  requestPhone: RequestPhoneState;
  signupReward: SignupRewardState;
  requestNotificationTime: RequestNotificationTimeState;
  vipChatRequest: VipChatRequestState;
  pickEmotionJourney: PickEmotionJourneyState;
  goalDaysPerWeek: GoalDaysPerWeekState;
  tryAIJourney: TryAIJourneyState;
};