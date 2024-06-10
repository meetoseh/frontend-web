import { ReactElement } from 'react';
import { ValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { Result } from '../../../shared/requests/RequestHandler';
import { ScreenContext } from '../hooks/useScreenContext';

/**
 * The information received about the server about the screen to show or a screen
 * that should be prefetched.
 */
export type PeekedScreen<SlugT extends string, ParamT extends object> = {
  /**
   * Identifies the component to show.
   */
  slug: SlugT;

  /**
   * Configures how the screen behaves
   */
  parameters: ParamT;
};

/**
 * Prior to rendering the component, in order to avoid sequential spinners (which
 * appears as flickering), we first load the resources that the screen needs.
 *
 * This is the interface that all screen resources must implement.
 */
export type ScreenResources = {
  /**
   * True if the PeekedScreen these resources were initialized with can be
   * rendered without a spinner, false if the screen needs more time to load.
   */
  ready: ValueWithCallbacks<boolean>;

  /**
   * When called, releases any requests on shared resources (typically, the
   * resources within the Resources object in ScreenContext). After being
   * called this object can be considered in an invalid state.
   *
   * MUST be idempotent, i.e., calling it multiple times should have the same
   * effect as calling it once.
   */
  dispose: () => void;
};

/**
 * The function that a screen can use to start popping off the current screen.
 *
 * @param trigger The trigger to execute
 * @param endpoint The endpoint to use for the pop; if not provided, uses
 *   /api/1/users/me/screens/pop by default. Must be api-compatible with the
 *   normal pop endpoint, though often stricter.
 * @param onError If provided, we call this function if an error occurs.
 *   If not provided, the error is displayed in a generic way.
 */
export type ScreenStartPop = (
  trigger: { slug: string; parameters: any } | null,
  endpoint?: string,
  onError?: (err: unknown) => void
) => () => void;

export type ScreenComponentProps<
  SlugT extends string,
  InstanceResourcesT extends ScreenResources,
  MappedParamT extends object
> = {
  /** The shared context between all screens */
  ctx: ScreenContext;
  /** The instance of the screen to render */
  screen: PeekedScreen<string, MappedParamT>;
  /** The resources associated with the instance of the screen */
  resources: InstanceResourcesT;
  /**
   * A function which can be called to begin the process of popping the current
   * screen remotely, and then called again to apply the change locally. It is
   * intended that this is called as soon as the exit transition starts, and
   * the returned function is called when the exit transition finishes.
   */
  startPop: ScreenStartPop;
  /**
   * Stores a trace event for the screen; this involves a network request
   * and thus doesn't actually finish instantly, but the network request
   * is never required to complete before starting some other action, and
   * doesn't need to finish (or even start) before popping the screen.
   */
  trace: (event: object) => void;
};

/**
 * The interface for a ClientScreen.
 *
 * @template SlugT a string literal corresponding to slug that identifies this screen
 * @template InstanceResourcesT the actual screen resources that are loaded per-instance
 * @template APIParamT the screen input parameters for the screen as received from the server
 * @template MappedParamT the screen input parameters for the screen after mapping
 */
export type OsehScreen<
  SlugT extends string,
  InstanceResourcesT extends ScreenResources,
  APIParamT extends object,
  MappedParamT extends { __mapped?: true }
> = {
  /**
   * The slug that identifies this screen.
   */
  slug: SlugT;

  /**
   * Maps the API representation of the screen input parameters to the preferred
   * format, typically switching snake_case to camelCase, converting e.g. timestamps
   * to Date objects, handling compatibility, etc.
   */
  paramMapper: (apiParams: APIParamT) => MappedParamT;

  /**
   * Initializes the resources that are specific to one instance of this screen.
   * A single `Screen` object may be used to concurrently initialize many instances
   * of the same screen.
   *
   * @param ctx the shared context between all screens
   * @param screen the screen to initialize resources for
   * @param refreshScreen a function that can be called to refresh the screen, usually
   *   used to refresh JWTs as required.
   */
  initInstanceResources: (
    ctx: ScreenContext,
    screen: PeekedScreen<SlugT, MappedParamT>,
    refreshScreen: () => CancelablePromise<Result<PeekedScreen<SlugT, MappedParamT>>>
  ) => InstanceResourcesT;

  /**
   * Renders an instance of the screen
   *
   * @param param The parameters for the screen
   * @returns The react element to render
   */
  component: (
    params: ScreenComponentProps<SlugT, InstanceResourcesT, MappedParamT> & { key: string }
  ) => ReactElement;
};
