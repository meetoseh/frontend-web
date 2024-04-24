import { CrudFetcherKeyMap, CrudFetcherMapper, convertUsingMapper } from '../crud/CrudFetcher';

export type TouchPointSelectionStrategy =
  | 'fixed'
  | 'random_with_replacement'
  | 'ordered_resettable';

type TouchPointMessageBase = {
  /**
   * Messages with lower priority are sent first with most selection strategies
   */
  priority: number;

  /**
   * The unique identifier for this message within this touch point
   */
  uid: string;
};

export type TouchPointSmsMessage = TouchPointMessageBase & {
  /**
   * The format string for the body of the message, python {}-style with
   * named parameters from `bodyParameters`
   *
   * Ex: `'Hello {name}'`
   */
  bodyFormat: string;

  /**
   * The parameters from the event parameters list which are substituted into
   * the body format.
   *
   * Ex: `['name']`
   */
  bodyParameters: string[];
};

export const touchPointSmsMessageKeyMap: CrudFetcherMapper<TouchPointSmsMessage> = {
  body_format: 'bodyFormat',
  body_parameters: 'bodyParameters',
};

export type TouchPointPushMessage = TouchPointMessageBase & {
  /**
   * The format for the title of the message, python {}-style with named
   * parameters from `titleParameters`
   *
   * Ex: `'Hello {name}'`
   */
  titleFormat: string;

  /**
   * The parameters from the event parameters list which are substituted into
   * the title format.
   */
  titleParameters: string[];

  /**
   * The format for the body of the message, python {}-style with named
   * parameters from `bodyParameters`
   *
   * Ex: `'Hello {name}'`
   */
  bodyFormat: string;

  /**
   * The parameters from the event parameters list which are substituted into
   * the body format.
   */
  bodyParameters: string[];

  /** The channel id for android, e.g., `default` */
  channelId: string;
};

export const touchPointPushMessageKeyMap: CrudFetcherMapper<TouchPointPushMessage> = {
  title_format: 'titleFormat',
  title_parameters: 'titleParameters',
  body_format: 'bodyFormat',
  body_parameters: 'bodyParameters',
  channel_id: 'channelId',
};

export type TouchPointTemplateParameterSubstitution = {
  /** The path to the key to set */
  key: string[];

  /**
   * The format for the value of the key, python {}-style with named parameters
   * from `parameters`
   *
   * Ex: `'Hello {name}'`
   */
  format: string;

  /**
   * The parameters from the event parameters list which are substituted into
   * the format.
   */
  parameters: string[];
};

export type TouchPointEmailMessage = TouchPointMessageBase & {
  /**
   * The format for the subject of the message, python {}-style with named
   * parameters from `subjectParameters`
   *
   * Ex: `'Hello {name}'`
   */
  subjectFormat: string;

  /**
   * The parameters from the event parameters list which are substituted into
   * the subject format.
   */
  subjectParameters: string[];

  /**
   * The slug of the template within email-templates
   */
  template: string;

  /**
   * The template parameters that are filled with fixed values. This can be
   * any json object, though usually it's just filling in strings (e.g.,
   * the preview text) or booleans (toggling parts of the template).
   *
   * This may contain nested json objects, which fill in nested values as expected.
   */
  templateParametersFixed: Record<string, unknown>;

  /**
   * The template parameters that are filled with values from the event
   * parameters list. This is a list of substitutions, where each substitution
   * is a key path, a format string, and a list of parameters. Substitutions
   * are applied in order, so if there are duplicate key lists (not expected),
   * the last one will be used. These are applied after and will override the
   * fixed parameters, though overlap is not common.
   */
  templateParametersSubstituted: TouchPointTemplateParameterSubstitution[];
};

export const touchPointEmailMessageKeyMap: CrudFetcherMapper<TouchPointEmailMessage> = {
  subject_format: 'subjectFormat',
  subject_parameters: 'subjectParameters',
  template_parameters_fixed: 'templateParametersFixed',
  template_parameters_substituted: 'templateParametersSubstituted',
};

export type TouchPointMessages = {
  /** the SMS messages, in ascending priority order, ties broken according to selection strategy */
  sms: TouchPointSmsMessage[];
  /** the push messages, in ascending priority order, ties broken according to selection strategy */
  push: TouchPointPushMessage[];
  /** the email messages, in ascending priority order, ties broken according to selection strategy */
  email: TouchPointEmailMessage[];
};

export const touchPointMessagesKeyMap: CrudFetcherMapper<TouchPointMessages> = (raw) => ({
  sms: (raw.sms as any[]).map((sms) => convertUsingMapper(sms, touchPointSmsMessageKeyMap)),
  push: (raw.push as any[]).map((push) => convertUsingMapper(push, touchPointPushMessageKeyMap)),
  email: (raw.email as any[]).map((email) =>
    convertUsingMapper(email, touchPointEmailMessageKeyMap)
  ),
});

type TouchPointBase = {
  /** Primary stable external row identifier */
  uid: string;

  /**
   * The event slug that triggers the touch point. This is user-specified,
   * and may be imbued with special meaning by referencing it directly in
   * code (e.g., daily_reminders is triggered according to rather complex
   * business logic in the jobs repo)
   */
  eventSlug: string;

  /**
   * Decides how the touch point stystem decides which message to send
   * once the event has been triggered. The decision will include state
   * which is stored per-user, per-touch-point.
   */
  selectionStrategy: TouchPointSelectionStrategy;

  /** When this touch point was created */
  createdAt: Date;
};

const touchPointBaseKeyMap: CrudFetcherKeyMap<TouchPointBase> = {
  event_slug: 'eventSlug',
  selection_strategy: 'selectionStrategy',
  created_at: (_, v) => ({ key: 'createdAt', value: new Date(v * 1000) }),
};

export type TouchPointNoMessages = TouchPointBase & {
  messages: null;
  messagesEtag: null;
};

export const touchPointNoMessagesKeyMap: CrudFetcherMapper<TouchPointNoMessages> = {
  ...touchPointBaseKeyMap,
  messages_etag: 'messagesEtag',
};

export type TouchPointWithMessages = TouchPointBase & {
  /** The messages which are sent by this touch point according to its selection strategy */
  messages: TouchPointMessages;
  /** A strong etag-like value for messages; changes iff messages changes, but is shorter */
  messagesEtag: string;
};

export const touchPointWithMessagesKeyMap: CrudFetcherMapper<TouchPointWithMessages> = {
  ...touchPointBaseKeyMap,
  messages: (_, v) => ({ key: 'messages', value: convertUsingMapper(v, touchPointMessagesKeyMap) }),
  messages_etag: 'messagesEtag',
};

/**
 * Provided for completeness; the type if you are not sure if you will receive
 * messages are not. Generally it's always deterministic and thus this isn't
 * necessary.
 */
export type TouchPoint = TouchPointNoMessages | TouchPointWithMessages;

export const touchPointKeyMap: CrudFetcherMapper<TouchPoint> = (raw) => {
  if (raw.messages === null || raw.messages === undefined) {
    return convertUsingMapper(raw, touchPointNoMessagesKeyMap);
  }
  return convertUsingMapper(raw, touchPointWithMessagesKeyMap);
};
