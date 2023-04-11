import { CrudFetcherKeyMap, convertUsingKeymap } from '../../../../admin/crud/CrudFetcher';
import { OsehImageRef } from '../../../../shared/OsehImage';

/**
 * The display data used for the phone-04102023 variant of the chat request
 * prompt.
 */
export type Phone04102023Variant = {
  /**
   * The identifier for this variant
   */
  identifier: 'phone-04102023';

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

const phone04102023VariantKeyMap: CrudFetcherKeyMap<Phone04102023Variant> = {
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
   * The variant of the prompt to display to the user and the corresponding
   * display data.
   */
  variant: Phone04102023Variant;
};

/**
 * Converts the given api representation of a vip chat request into
 * the internal representation.
 */
export const convertVipChatRequest = (v: any): VipChatRequest => {
  if (v.variant.identifier !== 'phone-04102023') {
    throw new Error('Unknown variant: ' + v.variant);
  }

  return {
    uid: v.uid,
    variant: convertUsingKeymap(v.variant, phone04102023VariantKeyMap),
  };
};

/**
 * The state required to determine if we should prompt the user to contact
 * an admin.
 */
export type VipChatRequestState = {
  /**
   * The chat request, if there is one, null if there isn't one, and undefined
   * if we're not sure yet
   */
  chatRequest: VipChatRequest | null | undefined;

  /**
   * Should be called when the user has completed the chat request, by
   * closing it or completing the action. This does not handle any
   * networking, it merely updates the state to remove the pending
   * chat request.
   */
  onDone: () => VipChatRequestState;

  /**
   * The window size to use, or undefined if the real window size should be used.
   * This is primarily intended for forcing the window size in admin for previewing
   * purposes.
   */
  forcedWindowSize?: { width: number; height: number };

  /**
   * True to suppress sending events. This is used for previewing the component.
   */
  suppressEvents?: boolean;
};
