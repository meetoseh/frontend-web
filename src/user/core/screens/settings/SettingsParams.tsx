import { CrudFetcherMapper, convertUsingKeymap } from '../../../../admin/crud/CrudFetcher';

type SettingsTrigger = {
  /** The trigger to use with no parameters */
  trigger: string | null;

  // we currently don't allow specifying the exit transition to avoid an
  // excessively large screen schema
};

type SettingsLink = {
  /** The URL to direct the user to */
  url: string;
};

export type SettingsAPIParams = {
  /** Handles if the user wants to upgrade to Oseh+. Only shown if they don't currently have Oseh+ */
  upgrade: SettingsTrigger;

  /** Handles if the user wants to manage their Oseh+ membership. Only shown if they have Oseh+ */
  membership: SettingsTrigger;

  /** Handles if the user wants to view their history */
  history: SettingsTrigger;

  // provider identities is handled through dynamically generated links

  /** Handles if the user wants to review their reminder settings */
  reminders: SettingsTrigger;

  /** Handles if the user wants to review their goal */
  goal: SettingsTrigger;

  /** Handles if  the user wants to contact support */
  support: SettingsTrigger;

  /** Handles if the user wants to view the privacy policy */
  privacy: SettingsLink;

  /** Handles if the user wants to view the terms */
  terms: SettingsLink;

  // restore purchases handled via revenuecat
  // delete account handled via modal

  /** Handles if the user presses the home button in the bottom nav */
  home: SettingsTrigger;

  /** Handles if the user presses the series button in the bottom nav */
  series: SettingsTrigger;
};

export type SettingsMappedParams = SettingsAPIParams & {
  /** Handles if the user wants to delete their account */
  __mapped: true;
};

const basicKeyMap: CrudFetcherMapper<SettingsMappedParams> = {};

export const settingsParamsKeyMap: CrudFetcherMapper<SettingsMappedParams> = (v) => {
  const result = convertUsingKeymap(v, basicKeyMap);
  result.__mapped = true;
  return result;
};
