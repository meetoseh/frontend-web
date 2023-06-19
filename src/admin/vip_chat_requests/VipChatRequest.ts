import { OsehImageRef } from '../../shared/images/OsehImageRef';
import { CrudFetcherKeyMap, convertUsingKeymap } from '../crud/CrudFetcher';

type User = {
  sub: string;
  givenName: string;
  familyName: string;
  email: string;
  createdAt: Date;
};

const userKeyMap: CrudFetcherKeyMap<User> = {
  given_name: 'givenName',
  family_name: 'familyName',
  created_at: (_, v: number) => ({ key: 'createdAt', value: new Date(v * 1000) }),
};

/**
 * The display data used for the phone-04102023 variant of the chat request
 * prompt.
 */
export type Phone04102023AdminDisplayData = {
  /**
   * The phone number to direct the user to contact
   */
  phoneNumber: string;

  /**
   * The text to prefill for the user to send to the admin
   */
  textPrefill: string;

  /**
   * The background of the prompt
   */
  backgroundImage: OsehImageRef;

  /**
   * The personal image for the prompt, usually a picture of the founder
   * who wants to contact them
   */
  image: OsehImageRef;

  /**
   * The caption for the image
   */
  imageCaption: string;

  /**
   * The title for the prompt
   */
  title: string;

  /**
   * The message for why we want the user to contact us
   */
  message: string;

  /**
   * The call-to-action text for the prompt
   */
  cta: string;
};

const phone04102023AdminDisplayDataKeyMap: CrudFetcherKeyMap<Phone04102023AdminDisplayData> = {
  phone_number: 'phoneNumber',
  text_prefill: 'textPrefill',
  background_image: 'backgroundImage',
  image_caption: 'imageCaption',
};

/**
 * Describes a request that an admin made to talk to a particular user. The user
 * will see a prompt the next time that they open the website or the app with
 * contact information.
 */
export type VipChatRequest = {
  /**
   * Primary stable external identifier for this chat request.
   */
  uid: string;

  /**
   * The user who the admin wants to talk to.
   */
  user: User;

  /**
   * The user who made the request, if known
   */
  addedByUser: User | null;

  /**
   * The variant of the prompt that the user will see.
   */
  variant: 'phone-04102023';

  /**
   * The display information based on the variant.
   */
  displayData: Phone04102023AdminDisplayData;

  /**
   * The reason for the request, only used internally
   */
  reason: string | null;

  /**
   * When we initiated the request
   */
  createdAt: Date;

  /**
   * If the user has seen the request, when they saw it
   */
  popupSeenAt: Date | null;
};

const vipChatRequestKeyMap: CrudFetcherKeyMap<VipChatRequest> = {
  user: (_, v) => ({ key: 'user', value: convertUsingKeymap(v, userKeyMap) }),
  added_by_user: (_, v) => ({
    key: 'addedByUser',
    value: v === null ? null : convertUsingKeymap(v, userKeyMap),
  }),
  display_data: 'displayData',
  created_at: (_, v: number) => ({ key: 'createdAt', value: new Date(v * 1000) }),
  popup_seen_at: (_, v: number | null) => ({
    key: 'popupSeenAt',
    value: v === null ? null : new Date(v * 1000),
  }),
};

/**
 * Converts the given api representation of the vip chat request to its standard
 * representation. This is a bit more complex than a standard keymap due to the
 * interlinking between the variant and the display data.
 *
 * @param v The api representation of the vip chat request
 * @returns The standard representation of the vip chat request
 */
export const convertVipChatRequest = (v: any): VipChatRequest => {
  const res = convertUsingKeymap(v, vipChatRequestKeyMap);

  if (res.variant !== 'phone-04102023') {
    throw new Error(`unknown variant: ${res.variant}`);
  }

  res.displayData = convertUsingKeymap(res.displayData, phone04102023AdminDisplayDataKeyMap);
  return res;
};
