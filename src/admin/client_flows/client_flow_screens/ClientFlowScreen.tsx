import { createUID } from '../../../shared/lib/createUID';
import { CrudFetcherMapper, convertUsingMapper } from '../../crud/CrudFetcher';
import {
  ClientFlowPredicate,
  clientFlowPredicateMapper,
  serializeClientFlowPredicate,
} from './ClientFlowPredicate';

export type ClientFlowScreenVariableInputStringFormat = {
  /**
   * - `string_format`: indicates we use a python-style format string to produce
   *   the output value, which is always a string. Use square brackets for nesting.
   *   There are three top-level dicts: `standard`, `server`, and `client`, referring
   *   to the standard parameters (untrusted), the server parameters (trusted), and the
   *   client parameters (untrusted). Example: `'Hello, {standard[user][name]}'`
   */
  type: 'string_format';

  /**
   * The format string to use, e.g, `'Hello, {standard[user][name]}'`
   */
  format: string;

  /**
   * Where to store the result in the screen input parameters. E.g.,
   * ['foo', 'bar', 2, 'baz'] would place the result in `foo.bar[2].baz`.
   */
  outputPath: (string | number)[];
};

export const clientFlowScreenVariableInputStringFormatKeyMap: CrudFetcherMapper<ClientFlowScreenVariableInputStringFormat> =
  {
    output_path: 'outputPath',
  };

export const serializeClientFlowScreenVariableInputStringFormat = (
  x: ClientFlowScreenVariableInputStringFormat
): any => ({
  type: x.type,
  format: x.format,
  output_path: x.outputPath,
});

export type ClientFlowVariableInputCopy = {
  /**
   * - `copy`: indicates we should take one of the standard, server, or client
   *   parameters and copy it into the screen input parameters.
   */
  type: 'copy';

  /**
   * The path to the value to copy. E.g., ['standard', 'user', 'name'] would
   * copy the value at `standard.user.name`.
   */
  inputPath: string[];
  outputPath: (string | number)[];
};

export const clientFlowVariableInputCopyKeyMap: CrudFetcherMapper<ClientFlowVariableInputCopy> = {
  input_path: 'inputPath',
  output_path: 'outputPath',
};

export const serializeClientFlowVariableInputCopy = (x: ClientFlowVariableInputCopy): any => ({
  type: x.type,
  input_path: x.inputPath,
  output_path: x.outputPath,
});

export type ClientFlowVariableInputExtract = {
  /**
   * - `extract`: like copy, but when the flow is triggered, take the input parameter
   *   and convert it to an object based on its format (e.g., course_uid), then pluck
   *   from that object and put that as the input parameter for the flow screen
   */
  type: 'extract';
  inputPath: string[];
  /**
   * The path to pluck from after realizing the input parameter. E.g., ['intro_video', 'uid']
   */
  extractedPath: string[];
  outputPath: (string | number)[];
  /**
   * If true, _at trigger time_, if after converting the input path, while walking along the
   * extracted path we encounter a null or undefined value, the screen will be skipped instead
   * of added to the users screen queue.
   */
  skipIfMissing: boolean;
};

export const clientFlowVariableInputExtractKeyMap: CrudFetcherMapper<ClientFlowVariableInputExtract> =
  {
    input_path: 'inputPath',
    extracted_path: 'extractedPath',
    output_path: 'outputPath',
    skip_if_missing: 'skipIfMissing',
  };

export const serializeClientFlowVariableInputExtract = (
  x: ClientFlowVariableInputExtract
): any => ({
  type: x.type,
  input_path: x.inputPath,
  extracted_path: x.extractedPath,
  output_path: x.outputPath,
  skip_if_missing: x.skipIfMissing,
});

export type ClientFlowScreenVariableInput =
  | ClientFlowScreenVariableInputStringFormat
  | ClientFlowVariableInputCopy
  | ClientFlowVariableInputExtract;

export type ClientFlowScreenScreen = {
  /** The slug of the screen to initialize */
  slug: string;
  /** When building the screen input parameters, start with a copy of this */
  fixed: object;
  /**
   * When building the screen input parameters, fill in the result in order with
   * these values.
   */
  variable: ClientFlowScreenVariableInput[];
};

export const serializeClientFlowScreenScreenVariable = (
  x: ClientFlowScreenScreen['variable']
): any =>
  x.map((x) => {
    if (x.type === 'string_format') {
      return serializeClientFlowScreenVariableInputStringFormat(x);
    }
    if (x.type === 'copy') {
      return serializeClientFlowVariableInputCopy(x);
    }
    if (x.type === 'extract') {
      return serializeClientFlowVariableInputExtract(x);
    }
    throw new Error(`Unknown type: ${x}`);
  });

export const clientFlowScreenScreenVariableKeyMap: CrudFetcherMapper<
  ClientFlowScreenScreen['variable']
> = (v) =>
  v.map((x: any) => {
    if (x.type === 'string_format') {
      return convertUsingMapper(x, clientFlowScreenVariableInputStringFormatKeyMap);
    }
    if (x.type === 'copy') {
      return convertUsingMapper(x, clientFlowVariableInputCopyKeyMap);
    }
    if (x.type === 'extract') {
      return convertUsingMapper(x, clientFlowVariableInputExtractKeyMap);
    }
    throw new Error(`Unknown type: ${x}`);
  });

export const clientFlowScreenScreenKeyMap: CrudFetcherMapper<ClientFlowScreenScreen> = {
  variable: (_, v) => ({
    key: 'variable',
    value: convertUsingMapper(v, clientFlowScreenScreenVariableKeyMap),
  }),
};

export const serializeClientFlowScreenScreen = (x: ClientFlowScreenScreen): any => ({
  slug: x.slug,
  fixed: x.fixed,
  variable: serializeClientFlowScreenScreenVariable(x.variable),
});

/**
 * Describes the bits on the `flags` field on a client flow screen. Set bits
 * do nothing, whereas unset bits prevent the screen from being shown in
 * the related context
 */
export enum ClientFlowScreenFlag {
  /** If unset, the screen should be skipped at peek time on the iOS platform */
  SHOWS_ON_IOS = 1 << 0,

  /** If unset, the screen should be skipped at peek time on the Android platform */
  SHOWS_ON_ANDROID = 1 << 1,

  /** If unset, the screen should be skipped at peek time on the web platform */
  SHOWS_ON_WEB = 1 << 2,

  /** If unset, the screen should be skipped if the user does not have Oseh+ */
  SHOWS_FOR_FREE = 1 << 3,

  /** If unset, the screen should be skipped if the user has Oseh+ */
  SHOWS_FOR_PRO = 1 << 4,
}

export type ClientFlowScreen = {
  /**
   * An arbitrary random string we associated with this client flow screen on the client
   * to help keep track of it
   */
  clientSideUid: string;
  /** A hint used in the admin area for this screen */
  name?: string | null;
  /** The screen which should be displayed */
  screen: ClientFlowScreenScreen;
  /** Which client flows can be triggered by the client when popping this screen */
  allowedTriggers: string[];
  /** A bitfield of flags; see ClientFlowScreenFlag */
  flags: number;
  /** Rules which must be met for the screen to actually be shown */
  rules: {
    /** This predicate must be true at trigger time or the flow screen is not queued */
    trigger: ClientFlowPredicate | null;
    /** This predicate must be true at peek time or the flow screen is skipped */
    peek: ClientFlowPredicate | null;
  };
};

export const clientFlowScreenKeyMap: CrudFetcherMapper<ClientFlowScreen> = (v: any) => ({
  clientSideUid: createUID(),
  name: v.name,
  screen: convertUsingMapper(v.screen, clientFlowScreenScreenKeyMap),
  allowedTriggers: v.allowed_triggers,
  flags: v.flags,
  rules: {
    trigger:
      v.rules.trigger !== null && v.rules.trigger !== undefined
        ? convertUsingMapper(v.rules.trigger, clientFlowPredicateMapper)
        : null,
    peek:
      v.rules.peek !== null && v.rules.peek !== undefined
        ? convertUsingMapper(v.rules.peek, clientFlowPredicateMapper)
        : null,
  },
});

export const serializeClientFlowScreen = (x: ClientFlowScreen): any => ({
  screen: serializeClientFlowScreenScreen(x.screen),
  name: x.name === '' ? null : x.name ?? null,
  allowed_triggers: x.allowedTriggers,
  flags: x.flags,
  rules: {
    trigger: x.rules.trigger === null ? null : serializeClientFlowPredicate(x.rules.trigger),
    peek: x.rules.peek === null ? null : serializeClientFlowPredicate(x.rules.peek),
  },
});
