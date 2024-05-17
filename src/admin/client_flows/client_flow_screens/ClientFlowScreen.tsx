import { createUID } from '../../../shared/lib/createUID';
import { CrudFetcherMapper, convertUsingMapper } from '../../crud/CrudFetcher';

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
   * ['foo', 'bar'] would place the result in `foo.bar`.
   */
  outputPath: string[];
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
  outputPath: string[];
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

export type ClientFlowScreenVariableInput =
  | ClientFlowScreenVariableInputStringFormat
  | ClientFlowVariableInputCopy;

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
};

export const clientFlowScreenKeyMap: CrudFetcherMapper<ClientFlowScreen> = (v: any) => ({
  clientSideUid: createUID(),
  name: v.name,
  screen: convertUsingMapper(v.screen, clientFlowScreenScreenKeyMap),
  allowedTriggers: v.allowed_triggers,
});

export const serializeClientFlowScreen = (x: ClientFlowScreen): any => ({
  screen: serializeClientFlowScreenScreen(x.screen),
  name: x.name ?? null,
  allowed_triggers: x.allowedTriggers,
});