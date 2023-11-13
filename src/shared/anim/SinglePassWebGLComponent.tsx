import { ReactElement, useEffect, useMemo, useRef } from 'react';
import { Callbacks } from '../lib/Callbacks';

/**
 * The basic render state for a WebGL component which uses a single render pass.
 */
export type RenderState<A extends string, U extends string, B extends string, T extends string> = {
  /**
   * The WebGL context.
   */
  gl: WebGLRenderingContext;
  /**
   * The program used to render the component.
   */
  program: WebGLProgram;
  /**
   * The attribute names mapped to the attribute locations. Attributes are
   * typically used to pass per-vertex data to the vertex shader, e.g.,
   * a position offset or the texture coordinates corresponding to a vertex.
   */
  attributes: Record<A, number>;
  /**
   * The uniform names mapped to the uniform location. Uniforms are used
   * to pass data that's constant for the whole pass, e.g., the resolution
   * or opacity.
   */
  uniforms: Record<U, WebGLUniformLocation>;
  /**
   * The buffers used to store vertex data. Buffers are used to fill attributes
   * with data.
   */
  buffers: Record<B, WebGLBuffer>;
  /**
   * The textures used to store image data. Textures are bound in order,
   * and the order they are bound is stored in the `unit` field, starting
   * at 0 and incrementing by 1 for each texture. The texture unit is all
   * that is required in teh render pass, but the actual texture is used
   * for cleanup.
   */
  textures: Record<T, { unit: number; val: WebGLTexture }>;
  /**
   * Disposes of all unmanaged resources used by the render state. This
   * is called prior to a new render state being created.
   */
  dispose: () => void;
};

/**
 * Describes an object capable of rendering a WebGL component using a single
 * render pass and a configurable props like object P.
 */
export type SinglePassWebGLComponentRenderer<
  A extends string,
  U extends string,
  B extends string,
  T extends string,
  P extends object
> = {
  /**
   * Initializes the WebGL context and program, returning the initial render
   * state. This is typically only called once when the component is mounted,
   * and the returned dispose function is called when the component is
   * unmounted.
   *
   * @param canvas The canvas to render to.
   * @returns The immutable render state.
   */
  initialize: (canvas: HTMLCanvasElement) => RenderState<A, U, B, T>;

  /**
   * Renders the component using the given render state and props. This is
   * called when the props change.
   *
   * @param state The render state.
   * @param props The props to render with.
   * @param dpi The number of physical pixels per logical pixel when we go
   *   to render. This can be useful since props should always be specified
   *   in logical pixels.
   */
  render: (state: RenderState<A, U, B, T>, props: P, dpi: number) => void;
};

type SinglePassWebGLComponentProps<
  A extends string,
  U extends string,
  B extends string,
  T extends string,
  P extends object
> = {
  /**
   * The renderer to use to render the component.
   */
  renderer: SinglePassWebGLComponentRenderer<A, U, B, T, P>;

  /**
   * The props to render with. This is a function so that the value of the props
   * can change without triggering a full react rerender, since webgl components
   * are often animated.
   *
   * The result of this function should only change if propsChanged is invoked
   * shortly afterward with the new props or this function is changed.
   *
   * Note that changing this function will cause the entire WebGL context to be
   * rebuilt, while changing the result will only cause the component to be
   * rerendered.
   */
  props: () => P;

  /**
   * Invoking these callbacks will cause the component to be rerendered with
   * the current props, immediately. This should only be called at most once
   * per frame when animating.
   *
   * Note that changing this instance will cause the entire WebGL context to be
   * rebuilt, while invoking the callbacks will only cause the component to be
   * rerendered.
   */
  propsChanged: Callbacks<undefined>;

  /**
   * The width of the canvas in logical pixels. Changing this value causes
   * the entire WebGL context to be rebuilt.
   */
  width: number;

  /**
   * The height of the canvas in logical pixels. Changing this value causes
   * the entire WebGL context to be rebuilt.
   */
  height: number;
};

/**
 * Renders a single-pass WebGL component onto a canvas, with a way to rerender
 * without causing a full react rerender.
 *
 * The props for this component would typically be animated using the
 * `AnimationLoop`.
 *
 * This component is designed that browsers will always provide a canvas whose
 * backing store is the same size as the number of physical pixels within the
 * canvas, rather than logical pixels, provided enough gpu memory is available.
 *
 * This renders nothing if the width or height are set to zero or webgl is not
 * available.
 */
export function SinglePassWebGLComponent<
  A extends string,
  U extends string,
  B extends string,
  T extends string,
  P extends object
>({
  renderer,
  props,
  propsChanged,
  width,
  height,
}: SinglePassWebGLComponentProps<A, U, B, T, P>): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current === null) {
      return;
    }

    if (width === 0 || height === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl');
    if (gl === null || gl === undefined || gl.isContextLost()) {
      return;
    }

    const dpi = devicePixelRatio;
    const state = renderer.initialize(canvas);
    const rerender = () => renderer.render(state, props(), dpi);
    rerender();
    propsChanged.add(rerender);

    let active = true;
    return () => {
      if (active) {
        active = false;
        propsChanged.remove(rerender);
        state.dispose();
      }
    };
  }, [renderer, props, propsChanged, width, height]);

  const canvasStyle = useMemo(() => {
    const translateFraction = (1 - 1 / devicePixelRatio) / 2;
    const translatePercent = translateFraction * 100;
    return {
      transform: `translate(-${translatePercent}%, -${translatePercent}%) scale(${
        1 / devicePixelRatio
      })`,
    };
  }, []);
  const containerStyle = useMemo(
    () => ({
      width: `${width}px`,
      height: `${height}px`,
      overflow: 'hidden',
    }),
    [width, height]
  );

  return (
    <div style={containerStyle}>
      <canvas
        ref={canvasRef}
        width={width * devicePixelRatio}
        height={height * devicePixelRatio}
        style={canvasStyle}
      />
    </div>
  );
}
