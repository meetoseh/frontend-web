import { FeedbackAnnouncementState } from '../features/feedbackAnnouncement/FeedbackAnnouncementState';
import { GoalDaysPerWeekState } from '../features/goalDaysPerWeek/GoalDaysPerWeekState';
import { PickEmotionJourneyState } from '../features/pickEmotionJourney/PickEmotionJourneyState';
import { RequestNameState } from '../features/requestName/RequestNameState';
import { RequestNotificationTimeState } from '../features/requestNotificationTime/RequestNotificationTimeState';
import { RequestPhoneState } from '../features/requestPhone/RequestPhoneState';
import { SignupRewardState } from '../features/signupReward/SignupRewardState';
import { VipChatRequestState } from '../features/vipChatRequest/VipChatRequestState';

export type FeatureAllStates = {
  feedbackAnnouncement: FeedbackAnnouncementState;
  requestName: RequestNameState;
  requestPhone: RequestPhoneState;
  signupReward: SignupRewardState;
  requestNotificationTime: RequestNotificationTimeState;
  vipChatRequest: VipChatRequestState;
  pickEmotionJourney: PickEmotionJourneyState;
  goalDaysPerWeek: GoalDaysPerWeekState;
};
