import { CrudFetcherMapper } from '../../../admin/crud/CrudFetcher';

type ScreenTextContentPartHeader = {
  /**
   * - `header`: open sans, 600 font weight, 22px font size, 28.6px line height, #eaeaeb
   */
  type: 'header';
  /** the text to show */
  value: string;
};

type ScreenTextContentPartBody = {
  /**
   * - `body`: open sans, 400 font weight, 16px font size, 24px line height, #c8cdd0
   */
  type: 'body';
  /** the text to show */
  value: string;
};

type ScreenTextContentPartCheck = {
  /**
   * - `check`: a check, followed by body text
   */
  type: 'check';
  /** the text to show right of the check */
  message: string;
};

type ScreenTextContentPartSpacer = {
  /**
   * - `spacer`: vertical spacer
   */
  type: 'spacer';
  /** number of pixels */
  pixels: number;
};

type ScreenTextContentPart =
  | ScreenTextContentPartHeader
  | ScreenTextContentPartBody
  | ScreenTextContentPartSpacer
  | ScreenTextContentPartCheck;

type ScreenTextContent = {
  type: 'screen-text-content';
  version: 1;
  parts: ScreenTextContentPart[];
};

export type ScreenTextContentAPI = ScreenTextContent;

export type ScreenTextContentPartMapped = ScreenTextContentPart;
export type ScreenTextContentMapped = ScreenTextContent;

export const screenTextContentMapper: CrudFetcherMapper<ScreenTextContentMapped> = (raw) => raw;
