import { ConfirmMergeAccountState } from '../features/confirmMergeAccount/ConfirmMergeAccountState';
import { FastUnsubscribeState } from '../features/fastUnsubscribe/FastUnsubscribeState';
import { FavoritesState } from '../features/favorites/FavoritesState';
import { GoalDaysPerWeekState } from '../features/goalDaysPerWeek/GoalDaysPerWeekState';
import { IsaiahCourseState } from '../features/isaiahCourse/IsaiahCourseState';
import { LoginState } from '../features/login/LoginState';
import { MergeAccountState } from '../features/mergeAccount/MergeAccountState';
import { PickEmotionJourneyState } from '../features/pickEmotionJourney/PickEmotionJourneyState';
import { RequestNameState } from '../features/requestName/RequestNameState';
import { RequestNotificationTimeState } from '../features/requestNotificationTime/RequestNotificationTimeState';
import { RequestPhoneState } from '../features/requestPhone/RequestPhoneState';
import { SeriesDetailsState } from '../features/seriesDetails/SeriesDetailsState';
import { SeriesListState } from '../features/seriesList/SeriesListState';
import { SeriesPreviewState } from '../features/seriesPreview/SeriesPreviewState';
import { SettingsState } from '../features/settings/SettingsState';
import { ShareJourneyState } from '../features/shareJourney/ShareJourneyState';
import { SignupRewardState } from '../features/signupReward/SignupRewardState';
import { TouchLinkState } from '../features/touchLink/TouchLinkState';
import { VipChatRequestState } from '../features/vipChatRequest/VipChatRequestState';

export type FeatureAllStates = {
  requestName: RequestNameState;
  requestPhone: RequestPhoneState;
  signupReward: SignupRewardState;
  requestNotificationTime: RequestNotificationTimeState;
  vipChatRequest: VipChatRequestState;
  pickEmotionJourney: PickEmotionJourneyState;
  goalDaysPerWeek: GoalDaysPerWeekState;
  favorites: FavoritesState;
  isaiahCourse: IsaiahCourseState;
  settings: SettingsState;
  touchLink: TouchLinkState;
  login: LoginState;
  fastUnsubscribe: FastUnsubscribeState;
  mergeAccount: MergeAccountState;
  confirmMergeAccount: ConfirmMergeAccountState;
  shareJourney: ShareJourneyState;
  seriesList: SeriesListState;
  seriesPreview: SeriesPreviewState;
  seriesDetails: SeriesDetailsState;
};
