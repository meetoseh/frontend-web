import { OsehImageRef } from '../../../../../shared/images/OsehImageRef';

/**
 * Describes the object that is mutated by WS /api/2/journals/chat/
 * events to describe a journal chat, which consists of contiguous
 * set of journal entry items. If it's one or multiple, and if it
 * describes the whole chat or just a part, is not defined by this
 * type or the endpoint itself, but rather how the journal chat JWT
 * was received. Typically it's clear from context - for example,
 * when you create a new journal entry, this is streaming the greeting
 * and thus the entire state of the journal entry
 */
export type JournalChatState = {
  /** the journal chat uid */
  uid: string;
  /**
   * hex sha256 value of the JSON (sorted keys and simple spacing) `data` field.
   * After a series of mutations from the server, this should match `computeJournalChatStateDataIntegrity`
   * on the JournalChatState (otherwise, we interpreted the mutations incorrectly)
   */
  integrity: string;
  /** the underlying data; should be considered sensitive */
  data: JournalEntryItemData[];
  /** if there is a current transient hint to show e.g. a spinner, that spinner, otherwise null */
  transient?: JournalChatTransientHint | null;
};

export type JournalChatTransientHintThinkingBar = {
  /**
   * - `thinking-bar`: the server is working on the request and can supply some
   *   progress information for the current step
   */
  type: 'thinking-bar';
  /** The numerator */
  at: number;
  /** The denominator */
  of: number;
  /** What the server is working on */
  message: string;
  /** Additional information, if any */
  detail: string | null;
};

export type JournalChatTransientHintThinkingSpinner = {
  /**
   * - `thinking-spinner`: the server is working on the request
   */
  type: 'thinking-spinner';
  /** What the server is working on */
  message: string;
  /** Additional information, if any */
  detail: string | null;
};

export type JournalChatTransientHint =
  | JournalChatTransientHintThinkingBar
  | JournalChatTransientHintThinkingSpinner;

/**
 * Computes the integrity value of the given data field on a JournalChatState
 * object. After a series of mutations, if this computed value does not match
 * the stored integrity value, then we misinterpreted the mutations (or the
 * server sent us bad mutations for what it was trying to accomplish), and we
 * should bail out
 */
export const computeJournalChatStateDataIntegrity = async (
  data: JournalChatState,
  debug?: boolean
): Promise<string> => {
  const stableSerializedAsUtf8String = dumpJournalChatStateForIntegrity(data);
  if (debug) {
    console.log(
      'computeJournalChatStateDataIntegrity: stableSerializedAsUtf8String',
      stableSerializedAsUtf8String
    );
  }
  const stableSerializedAsUint8Array = new TextEncoder().encode(stableSerializedAsUtf8String);
  const digestedAsArrayBuffer = await crypto.subtle.digest('SHA-256', stableSerializedAsUint8Array);
  const digestedAsUint8Array = new Uint8Array(digestedAsArrayBuffer);
  const digestedAsHexString = Array.from(digestedAsUint8Array)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return digestedAsHexString;
};

const dumpJournalChatStateForIntegrity = (data: JournalChatState): string => {
  let raw = '[';
  if (data.data.length > 0) {
    raw += dumpJournalEntryItemDataForIntegrity(data.data[0]);
    for (let i = 1; i < data.data.length; i++) {
      raw += ', ';
      raw += dumpJournalEntryItemDataForIntegrity(data.data[i]);
    }
  }
  raw += ']';
  return raw;
};

export type JournalEntryItemData = {
  /** what happened */
  data: JournalEntryItemDataData;
  /**
   * a rendering hint for who performed the action. note that even
   * for textual elements, a value of 'other' still may have been written
   * by the user, since we may let them edit system messages (e.g., the
   * reflection question)
   */
  display_author: 'self' | 'other';
  /**
   * the type of thing that occurred
   * - `chat`: conversation, mix of display authors
   * - `reflection-question`: a question to reflect on, usually from the system
   * - `reflection-response`: a response to a reflection question, usually from the user
   * - `ui`: went through a client flow, usually from the user
   * - `summary`: a summary of the entry up to this point
   */
  type: 'chat' | 'reflection-question' | 'reflection-response' | 'ui' | 'summary';
};

const dumpJournalEntryItemDataForIntegrity = (data: JournalEntryItemData): string => {
  let raw = '{"data": ';
  raw += dumpJournalEntryItemDataDataForIntegrity(data.data);
  raw += ', "display_author": "';
  raw += data.display_author;
  raw += '", "type": "';
  raw += data.type;
  raw += '"}';
  return raw;
};

export type JournalEntryItemDataDataTextual = {
  /** The parts that make up this piece */
  parts: JournalEntryItemTextualPart[];
  /**
   * - `textual`: Indicates this piece consisted of a document-style part
   */
  type: 'textual';
};

const dumpJournalEntryItemDataDataTextualForIntegrity = (
  data: JournalEntryItemDataDataTextual
): string => {
  let raw = '{"parts": [';
  if (data.parts.length > 0) {
    raw += dumpJournalEntryItemTextualPartForIntegrity(data.parts[0]);
    for (let i = 1; i < data.parts.length; i++) {
      raw += ', ';
      raw += dumpJournalEntryItemTextualPartForIntegrity(data.parts[i]);
    }
  }
  raw += '], "type": "textual"}';
  return raw;
};

export type JournalEntryItemTextualPartJourneyDetails = {
  /** The primary stable external identifier */
  uid: string;
  /** The short title */
  title: string;
  /** The longer description */
  description: string;
  /** The background image, pre-darkened */
  darkened_background: OsehImageRef;
  /** The duration in seconds */
  duration_seconds: number;
  /** The primary author */
  instructor: {
    /** Their display name */
    name: string;
    /** Their profile picture */
    image?: OsehImageRef | null;
  };
  /** When the user last took this class, or null/undefined if never */
  last_taken_at?: number | null;
  /*** When the user favorited the class if it's currently favorited, or null/undefined if not currently favorited */
  liked_at?: number | null;
  /** What the access situation is for the user */
  access: 'free' | 'paid-requires-upgrade' | 'paid-unlocked';
};

const dumpJournalEntryItemTextualPartJourneyDetailsForIntegrity = (
  data: JournalEntryItemTextualPartJourneyDetails
): string => {
  let raw = '{"access": "';
  raw += data.access;
  raw += '", "darkened_background": {"jwt": "';
  raw += data.darkened_background.jwt;
  raw += '", "uid": "';
  raw += data.darkened_background.uid;
  raw += '"}, "description": ';
  raw += JSON.stringify(data.description);
  raw += ', "duration_seconds": ';
  raw += encodeFloat(data.duration_seconds);
  raw += ', "instructor": {';
  if (data.instructor.image !== null && data.instructor.image !== undefined) {
    raw += '"image": {"jwt": "';
    raw += data.instructor.image.jwt;
    raw += '", "uid": "';
    raw += data.instructor.image.uid;
    raw += '"}, ';
  }
  raw += '"name": ';
  raw += JSON.stringify(data.instructor.name);
  raw += '}';
  if (data.last_taken_at !== null && data.last_taken_at !== undefined) {
    raw += ', "last_taken_at": ';
    raw += encodeFloat(data.last_taken_at);
  }
  if (data.liked_at !== null && data.liked_at !== undefined) {
    raw += ', "liked_at": ';
    raw += encodeFloat(data.liked_at);
  }
  raw += ', "title": ';
  raw += JSON.stringify(data.title);
  raw += ', "uid": "';
  raw += data.uid;
  raw += '"}';
  return raw;
};

export type JournalEntryItemTextualPartJourney = {
  /**
   * The details of the journey that was linked, so we can display
   * it in the chat
   */
  details: JournalEntryItemTextualPartJourneyDetails;
  /**
   * - `journey`: A link to a journey
   */
  type: 'journey';
  /** The UID of the journey that was linked */
  uid: string;
};

const dumpJournalEntryItemTextualPartJourneyForIntegrity = (
  data: JournalEntryItemTextualPartJourney
): string => {
  let raw = '{"details": ';
  raw += dumpJournalEntryItemTextualPartJourneyDetailsForIntegrity(data.details);
  raw += ', "type": "journey", "uid": "';
  raw += data.uid;
  raw += '"}';
  return raw;
};

export type JournalEntryItemTextualPartParagraph = {
  /**
   * - `paragraph`: A single paragraph of text
   */
  type: 'paragraph';
  /** The paragraph */
  value: string;
};

const dumpJournalEntryItemTextualPartParagraphForIntegrity = (
  data: JournalEntryItemTextualPartParagraph
): string => {
  let raw = '{"type": "paragraph", "value": ';
  raw += JSON.stringify(data.value);
  raw += '}';
  return raw;
};

type OsehTranscriptPhraseAPI = {
  /**
   * When the phrase begins in seconds from the beginning of the recording
   */
  starts_at: number;

  /**
   * When the phrase ends in seconds from the beginning of the recording
   */
  ends_at: number;

  /**
   * The actual text of the phrase
   */
  phrase: string;
};

const dumpOsehTranscriptPhraseAPIForIntegrity = (data: OsehTranscriptPhraseAPI): string => {
  let raw = '{"ends_at": ';
  raw += encodeFloat(data.ends_at);
  raw += ', "phrase": ';
  raw += JSON.stringify(data.phrase);
  raw += ', "starts_at": ';
  raw += encodeFloat(data.starts_at);
  raw += '}';
  return raw;
};

type OsehTranscriptAPI = {
  /** Typically an empty string */
  uid: string;

  /**
   * The phrases in ascending order of starts at, ends at usually non-overlapping,
   * but often not partitioning the entire recording due to periods of
   * silence
   */
  phrases: OsehTranscriptPhraseAPI[];
};

const dumpOsehTranscriptAPIForIntegrity = (data: OsehTranscriptAPI): string => {
  let raw = '{"phrases": [';
  if (data.phrases.length > 0) {
    raw += dumpOsehTranscriptPhraseAPIForIntegrity(data.phrases[0]);
    for (let i = 1; i < data.phrases.length; i++) {
      raw += ', ';
      raw += dumpOsehTranscriptPhraseAPIForIntegrity(data.phrases[i]);
    }
  }
  raw += '], "uid": "';
  raw += data.uid;
  raw += '"}';
  return raw;
};

export type JournalEntryItemTextualPartVoiceNote = {
  /** The transcription of the voice note with the uid set to an empty string */
  transcription: OsehTranscriptAPI;
  /**
   * - `voice_note`: A voice note
   */
  type: 'voice_note';
  /** A JWT for accessing the voice note */
  voice_note_jwt: string;
  /** The UID of the voice note */
  voice_note_uid: string;
};

const dumpJournalEntryItemTextualPartVoiceNoteForIntegrity = (
  data: JournalEntryItemTextualPartVoiceNote
): string => {
  let raw = '{"transcription": ';
  raw += dumpOsehTranscriptAPIForIntegrity(data.transcription);
  raw += ', "type": "voice_note", "voice_note_jwt": "';
  raw += data.voice_note_jwt;
  raw += '", "voice_note_uid": "';
  raw += data.voice_note_uid;
  raw += '"}';
  return raw;
};

export type JournalEntryItemTextualPart =
  | JournalEntryItemTextualPartJourney
  | JournalEntryItemTextualPartParagraph
  | JournalEntryItemTextualPartVoiceNote;

const dumpJournalEntryItemTextualPartForIntegrity = (data: JournalEntryItemTextualPart): string => {
  if (data.type === 'journey') {
    return dumpJournalEntryItemTextualPartJourneyForIntegrity(data);
  } else if (data.type === 'paragraph') {
    return dumpJournalEntryItemTextualPartParagraphForIntegrity(data);
  } else if (data.type === 'voice_note') {
    return dumpJournalEntryItemTextualPartVoiceNoteForIntegrity(data);
  } else {
    throw new Error(`Unknown type: ${(data as any).type}`);
  }
};

export type JournalEntryItemDataDataUI = {
  /** what this UI event was trying to accomplish */
  conceptually: JournalEntryItemUIConceptual;
  /** the flow that was triggered */
  flow: JournalEntryItemUIFlow;
  /**
   * - `ui`: the user went through a client flow
   */
  type: 'ui';
};

const dumpJournalEntryItemDataDataUIForIntegrity = (data: JournalEntryItemDataDataUI): string => {
  let raw = '{"conceptually": ';
  raw += dumpJournalEntryItemUIConceptualForIntegrity(data.conceptually);
  raw += ', "flow": ';
  raw += dumpJournalEntryItemUIFlowForIntegrity(data.flow);
  raw += ', "type": "ui"}';
  return raw;
};

export type JournalEntryItemUIConceptualUserJourney = {
  /** The UID of the journey */
  journey_uid: string;
  /**
   * - `user_journey`: we were trying to have the user take a journey
   */
  type: 'user_journey';
  /** The UID of the user journey that tracks the user took the journey */
  user_journey_uid: string;
};

const dumpJournalEntryItemUIConceptualUserJourneyForIntegrity = (
  data: JournalEntryItemUIConceptualUserJourney
): string => {
  let raw = '{"journey_uid": "';
  raw += data.journey_uid;
  raw += '", "type": "user_journey", "user_journey_uid": "';
  raw += data.user_journey_uid;
  raw += '"}';
  return raw;
};

export type JournalEntryItemUIConceptualUpgrade = {
  /**
   * - `upgrade`: we presented the user the opportunity to subscribe to Oseh+
   */
  type: 'upgrade';
};

const dumpJournalEntryItemUIConceptualUpgradeForIntegrity = (
  data: JournalEntryItemUIConceptualUpgrade
): string => '{"type": "upgrade"}';

export type JournalEntryItemUIConceptual =
  | JournalEntryItemUIConceptualUserJourney
  | JournalEntryItemUIConceptualUpgrade;

const dumpJournalEntryItemUIConceptualForIntegrity = (
  data: JournalEntryItemUIConceptual
): string => {
  if (data.type === 'user_journey') {
    return dumpJournalEntryItemUIConceptualUserJourneyForIntegrity(data);
  } else if (data.type === 'upgrade') {
    return dumpJournalEntryItemUIConceptualUpgradeForIntegrity(data);
  } else {
    throw new Error(`Unknown type: ${(data as any).type}`);
  }
};

export type JournalEntryItemUIFlow = {
  /** the slug of the client flow which was triggered */
  slug: string;
};

const dumpJournalEntryItemUIFlowForIntegrity = (data: JournalEntryItemUIFlow): string => {
  let raw = '{"slug": ';
  raw += JSON.stringify(data.slug);
  raw += '}';
  return raw;
};

export type JournalEntryItemDataDataSummaryV1 = {
  /**
   * The tags for the entry, where tags are generally formatted as an emoji followed
   * by the word, e.g., '😨 Anxious'
   */
  tags: string[];
  /** A summary of the entry up to this point; very short (3-4 words) */
  title: string;
  /** enum discriminator */
  type: 'summary';
  /** enum discriminator */
  version: 'v1';
};

const dumpJournalEntryItemDataDataSummaryV1ForIntegrity = (
  data: JournalEntryItemDataDataSummaryV1
): string => {
  let raw = '{"tags": [';
  if (data.tags.length > 0) {
    raw += JSON.stringify(data.tags[0]);
    for (let i = 1; i < data.tags.length; i++) {
      raw += ', ';
      raw += JSON.stringify(data.tags[i]);
    }
  }
  raw += '], "title": ';
  raw += JSON.stringify(data.title);
  raw += ', "type": "summary", "version": "v1"}';
  return raw;
};

export type JournalEntryItemDataDataSummary = JournalEntryItemDataDataSummaryV1;

const dumpJournalEntryItemDataDataSummaryForIntegrity = (
  data: JournalEntryItemDataDataSummary
): string => {
  if (data.version === 'v1') {
    return dumpJournalEntryItemDataDataSummaryV1ForIntegrity(data);
  } else {
    throw new Error(`Unknown version: ${(data as any).version}`);
  }
};

export type JournalEntryItemDataData =
  | JournalEntryItemDataDataTextual
  | JournalEntryItemDataDataUI
  | JournalEntryItemDataDataSummary;

const dumpJournalEntryItemDataDataForIntegrity = (data: JournalEntryItemDataData): string => {
  if (data.type === 'textual') {
    return dumpJournalEntryItemDataDataTextualForIntegrity(data);
  } else if (data.type === 'ui') {
    return dumpJournalEntryItemDataDataUIForIntegrity(data);
  } else if (data.type === 'summary') {
    return dumpJournalEntryItemDataDataSummaryForIntegrity(data);
  } else {
    throw new Error(`Unknown type: ${(data as any).type}`);
  }
};

const encodeFloat = (v: number): string => {
  /** Exactly matches python f"{v:.3f}" */
  return v.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    notation: 'standard',
    useGrouping: false,
  });
};
