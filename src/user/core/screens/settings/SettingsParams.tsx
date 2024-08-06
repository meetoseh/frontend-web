import { CrudFetcherMapper } from '../../../../admin/crud/CrudFetcher';
import {
  convertScreenConfigurableTriggerWithOldVersion,
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';

type SettingsLink = {
  /** The URL to direct the user to */
  url: string;
};

type SettingsParams<T> = {
  /** Handles if the user wants to upgrade to Oseh+. Only shown if they don't currently have Oseh+ */
  upgrade: T;

  /** Handles if the user wants to manage their Oseh+ membership. Only shown if they have Oseh+ */
  membership: T;

  /** Handles if the user wants to view their history */
  history: T;

  // provider identities is handled through dynamically generated links

  /** Handles if the user wants to review their reminder settings */
  reminders: T;

  /** Handles if the user wants to review their goal */
  goal: T;

  /** Handles if  the user wants to contact support; null for default support url */
  support?: T | null;

  /** Handles if the user wants to view the privacy policy */
  privacy: SettingsLink;

  /** Handles if the user wants to view the terms */
  terms: SettingsLink;

  // restore purchases handled via revenuecat
  // delete account handled via modal

  /** Handles if the user presses the home button in the bottom nav */
  home: T;

  /** Handles if the user presses the series button in the bottom nav */
  series: T;
};

type BtnAPI = {
  trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
  triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
};

export type SettingsAPIParams = SettingsParams<BtnAPI>;

type BtnMapped = {
  trigger: ScreenConfigurableTrigger;
};

export type SettingsMappedParams = SettingsParams<BtnMapped> & {
  /** Handles if the user wants to delete their account */
  __mapped: true;
};

const convertBtn = (api: BtnAPI): BtnMapped => ({
  trigger: convertScreenConfigurableTriggerWithOldVersion(api.trigger, api.triggerv75),
});

export const settingsParamsKeyMap: CrudFetcherMapper<SettingsMappedParams> = (v) => {
  const api = v as SettingsAPIParams;
  return {
    upgrade: convertBtn(api.upgrade),
    membership: convertBtn(api.membership),
    history: convertBtn(api.history),
    reminders: convertBtn(api.reminders),
    goal: convertBtn(api.goal),
    support:
      api.support === null ||
      api.support === undefined ||
      (api.support.triggerv75 === undefined && api.support.trigger === null)
        ? null
        : convertBtn(api.support),
    privacy: api.privacy,
    terms: api.terms,
    home: convertBtn(api.home),
    series: convertBtn(api.series),
    __mapped: true,
  };
};
