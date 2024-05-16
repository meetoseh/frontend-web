import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';

/**
 * Contains everything that any screen might want to eagerly preload. Generally,
 * if the resource is cacheable (like an image) and might be used by more than
 * one user client screen (e.g., two instances of the same screen), it should be
 * requested and received via the Resources object.
 *
 * If a resource is either trivial (e.g., some local computation) or is extremely
 * specific, it can be loaded per-instance instead.
 */
export type Resources = {
  /**
   * Handles loading all images. Since this object is essentially a wrapper around
   * a RequestHandler, the performance improvements of sharing can be achieved with
   * the simplicity of per-instance resource loading by calling request() on this
   * instance.
   */
  imageHandler: OsehImageStateRequestHandler;
};
