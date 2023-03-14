import { ReactElement, useEffect, useRef } from 'react';
import { ease, easeIn } from '../../../shared/lib/Bezier';
import {
  BezierAnimation,
  calculateAnimValue,
  updateAnim,
} from '../../../shared/lib/BezierAnimation';
import { Callbacks } from '../../../shared/lib/Callbacks';

// VPFRR = VerticalPartlyFilledRoundedRect

export type VPFRRState = {
  /**
   * The opacity of the overall element, 0-1
   */
  opacity: number;

  /**
   * The filled height as a fractional value 0-1
   */
  filledHeight: number;
};

export type VPFRRStateChangedEvent = {
  /**
   * The state prior to the change
   */
  old: VPFRRState;

  /**
   * The state after the change
   */
  current: VPFRRState;
};

type VPFRRProps = {
  /**
   * The height of the element to draw, in logical pixels
   */
  height: number;

  /**
   * The width of the element to draw, in logical pixels
   */
  width: number;

  /**
   * The border radius in logical pixels
   */
  borderRadius: number;

  /**
   * The color to use for the unfilled portion, as a series of numbers 0-1
   * representing the red, green, blue, and alpha components.
   */
  unfilledColor: [number, number, number, number];

  /**
   * The color to use for the filled portion, as a series of numbers 0-1
   * representing the red, green, blue, and alpha components. This is
   * rendered on top of the unfilled color.
   */
  filledColor: [number, number, number, number];

  /**
   * A function to fetch the current state
   */
  state: () => VPFRRState;

  /**
   * A function to fetch the callbacks we can register in to know when
   * the state changes.
   */
  onStateChanged: () => Callbacks<VPFRRStateChangedEvent>;

  /**
   * If specified, a border is drawn around the element.
   */
  border?: {
    /**
     * Width of the border, in logical pixels
     */
    width: number;

    /**
     * Color of the border, as a series of numbers 0-1 representing the
     * red, green, blue, and alpha components.
     */
    color: [number, number, number, number];
  };
};

const OPACITY_DURATION = 350;
const OPACITY_EASE = easeIn;

const HEIGHT_DURATION = 350;
const HEIGHT_EASE = ease;

/**
 * Renders a rectangle whose background fills vertically and which
 * has rounded corners.
 */
export const VerticalPartlyFilledRoundedRect = ({
  height: containerHeightLogicalPx,
  width: containerWidthLogicalPx,
  unfilledColor,
  borderRadius,
  filledColor,
  state,
  onStateChanged,
  border,
}: VPFRRProps): ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const callbacks = onStateChanged();

    let active = true;
    let animating = true;
    let opacity = 0;
    let height = state().filledHeight;
    let opacityAnimation: BezierAnimation | null = null;
    let heightAnimation: BezierAnimation | null = null;

    let canvas: HTMLCanvasElement | null = null;
    let glState: GlState | null = null;
    let disposeGl: (() => void) | null = null;

    callbacks.add(handleEvent);
    requestAnimationFrame(onFrame);
    return () => {
      active = false;
      callbacks.remove(handleEvent);
    };

    function handleEvent(event: VPFRRStateChangedEvent) {
      if (animating) {
        return;
      }

      if (opacity === event.current.opacity && height === event.current.filledHeight) {
        return;
      }

      animating = true;
      requestAnimationFrame(onFrame);
    }

    function onFrame(now: DOMHighResTimeStamp) {
      if (!active) {
        return;
      }

      const canvas = canvasRef.current;
      if (canvas === null) {
        requestAnimationFrame(onFrame);
        return;
      }

      const targetState = state();
      opacityAnimation = updateAnim({
        now,
        current: opacity,
        target: targetState.opacity,
        oldAnim: opacityAnimation,
        duration: OPACITY_DURATION,
        ease: OPACITY_EASE,
      });
      heightAnimation = updateAnim({
        now,
        current: height,
        target: targetState.filledHeight,
        oldAnim: heightAnimation,
        duration: HEIGHT_DURATION,
        ease: HEIGHT_EASE,
      });

      opacity =
        opacityAnimation === null ? targetState.opacity : calculateAnimValue(opacityAnimation, now);
      height =
        heightAnimation === null
          ? targetState.filledHeight
          : calculateAnimValue(heightAnimation, now);
      render(canvas);

      if (opacityAnimation !== null || heightAnimation !== null) {
        requestAnimationFrame(onFrame);
      } else {
        animating = false;
      }
    }

    function render(currentCanvas: HTMLCanvasElement) {
      if (canvas !== currentCanvas || glState === null) {
        if (disposeGl !== null) {
          disposeGl();
        }

        canvas = currentCanvas;
        const gl = canvas.getContext('webgl');
        if (gl === null) {
          throw new Error('Failed to get WebGL context');
        }

        [glState, disposeGl] = initializeGl(gl);
      }

      renderToGl(glState.gl, glState);
    }

    function initializeGl(gl: WebGLRenderingContext): [GlState, () => void] {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0, 0, 0, 0);

      const vert = gl.createShader(gl.VERTEX_SHADER);
      if (vert === null) {
        throw new Error('Failed to create vertex shader');
      }
      gl.shaderSource(
        vert,
        `
        #version 100

        attribute vec2 a_position;

        uniform vec2 u_resolution;

        varying vec2 v_position;

        void main(void) {
          gl_Position = vec4((a_position / u_resolution) * 2.0 - 1.0, 0.0, 1.0);
          v_position = a_position;
        }
        `
      );
      gl.compileShader(vert);
      const vertMessage = gl.getShaderInfoLog(vert);
      if (vertMessage !== null && vertMessage.length > 0) {
        throw new Error('Failed to compile vertex shader: ' + vertMessage);
      }

      const frag = gl.createShader(gl.FRAGMENT_SHADER);
      if (frag === null) {
        throw new Error('Failed to create fragment shader');
      }
      gl.shaderSource(
        frag,
        `
        #version 100

        precision highp float;

        uniform vec2 u_resolution;
        uniform float u_radius;
        uniform float u_thickness;
        uniform float u_fillHeight;
        uniform vec4 u_color;
        uniform vec4 u_bkndColor;

        varying vec2 v_position;

        void main(void) {
          float edgeSmoothness = 1.0;
          vec2 center = u_resolution / 2.0;
          vec2 positionAsIfTopRight = abs(v_position - center) + center;
          vec2 vecCircleCenterToPosition = positionAsIfTopRight - (u_resolution - vec2(u_radius, u_radius));
          float distanceFromCircleCenter = length(vecCircleCenterToPosition);
          bool isTopRightOfCircle = vecCircleCenterToPosition.x > 0.0 && vecCircleCenterToPosition.y > 0.0;
          bool isBottomLeftOfCircle = vecCircleCenterToPosition.x < 0.0 && vecCircleCenterToPosition.y < 0.0;
          bool isTopLeftOfCircle = vecCircleCenterToPosition.x < 0.0 && vecCircleCenterToPosition.y > 0.0;
          bool isBottomRightOfCircle = vecCircleCenterToPosition.x > 0.0 && vecCircleCenterToPosition.y < 0.0;
          float getsBackground = float(!isTopRightOfCircle) + float(isTopRightOfCircle) * (1.0 - step(u_radius, distanceFromCircleCenter));
          bool isInFill = v_position.y < u_fillHeight;
          float opacity = (
            1.0 
            // outer edge of circle
            - float(isTopRightOfCircle) * smoothstep(u_radius, u_radius + edgeSmoothness, distanceFromCircleCenter)
            // inner edge of circle
            - float(isTopRightOfCircle) * float(!isInFill) * (1.0 - smoothstep(u_radius - u_thickness - edgeSmoothness, u_radius - u_thickness, distanceFromCircleCenter))
            // bottom left is always not visible
            - float(isBottomLeftOfCircle) * float(!isInFill)
            // top left uses border thickness relative to the top
            - float(isTopLeftOfCircle) * float(!isInFill) * (1.0 - smoothstep(u_resolution.y - u_thickness - edgeSmoothness, u_resolution.y - u_thickness, positionAsIfTopRight.y))
            // bottom right uses border thickness relative to the right
            - float(isBottomRightOfCircle) * float(!isInFill) * (1.0 - smoothstep(u_resolution.x - u_thickness - edgeSmoothness, u_resolution.x - u_thickness, positionAsIfTopRight.x))
          );
          gl_FragColor = vec4(u_bkndColor.xyz, 1.0) * (1.0 - opacity) * u_bkndColor.a * getsBackground + vec4(u_color.xyz, 1.0) * opacity * u_color.a;
        }
        `
      );
      gl.compileShader(frag);
      const fragMessage = gl.getShaderInfoLog(frag);
      if (fragMessage !== null && fragMessage.length > 0) {
        throw new Error('Failed to compile fragment shader: ' + fragMessage);
      }

      const program = gl.createProgram();
      if (program === null) {
        throw new Error('Failed to create program');
      }
      gl.attachShader(program, vert);
      gl.attachShader(program, frag);
      gl.linkProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);

      const positionBuffer = gl.createBuffer();
      if (positionBuffer === null) {
        throw new Error('Failed to create position buffer');
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          0,
          0,
          gl.drawingBufferWidth,
          0,
          0,
          gl.drawingBufferHeight,
          0,
          gl.drawingBufferHeight,
          gl.drawingBufferWidth,
          0,
          gl.drawingBufferWidth,
          gl.drawingBufferHeight,
        ]),
        gl.STATIC_DRAW
      );

      const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
      if (resolutionLocation === null) {
        throw new Error('Failed to get resolution location');
      }

      const radiusLocation = gl.getUniformLocation(program, 'u_radius');
      if (radiusLocation === null) {
        throw new Error('Failed to get radius location');
      }

      const colorLocation = gl.getUniformLocation(program, 'u_color');
      if (colorLocation === null) {
        throw new Error('Failed to get color location');
      }

      const thicknessLocation = gl.getUniformLocation(program, 'u_thickness');
      if (thicknessLocation === null) {
        throw new Error('Failed to get thickness location');
      }

      const fillHeightLocation = gl.getUniformLocation(program, 'u_fillHeight');
      if (fillHeightLocation === null) {
        throw new Error('Failed to get fillHeight location');
      }

      const bkndColorLocation = gl.getUniformLocation(program, 'u_bkndColor');
      if (bkndColorLocation === null) {
        throw new Error('Failed to get bkndColor location');
      }

      return [
        {
          gl,
          program,
          locs: {
            position: gl.getAttribLocation(program, 'a_position'),
            resolution: resolutionLocation,
            radius: radiusLocation,
            color: colorLocation,
            thickness: thicknessLocation,
            fillHeight: fillHeightLocation,
            bkndColor: bkndColorLocation,
          },
          buffers: {
            position: positionBuffer,
          },
        },
        () => {
          gl.deleteBuffer(positionBuffer);
          gl.deleteProgram(program);
        },
      ];
    }

    function renderToGl(gl: WebGLRenderingContext, glState: GlState) {
      const dpi = gl.drawingBufferWidth / containerWidthLogicalPx;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(glState.program);

      gl.enableVertexAttribArray(glState.locs.position);
      gl.bindBuffer(gl.ARRAY_BUFFER, glState.buffers.position);
      gl.vertexAttribPointer(glState.locs.position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(glState.locs.resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1f(glState.locs.radius, dpi * borderRadius);
      gl.uniform1f(glState.locs.thickness, dpi * (border?.width ?? 0));
      gl.uniform1f(glState.locs.fillHeight, dpi * containerHeightLogicalPx * height);
      gl.uniform4f(
        glState.locs.color,
        filledColor[0],
        filledColor[1],
        filledColor[2],
        filledColor[3] * opacity
      );
      gl.uniform4f(
        glState.locs.bkndColor,
        unfilledColor[0],
        unfilledColor[1],
        unfilledColor[2],
        unfilledColor[3] * opacity
      );
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.disableVertexAttribArray(glState.locs.position);
      gl.flush();
    }
  }, [
    onStateChanged,
    state,
    border,
    borderRadius,
    filledColor,
    containerHeightLogicalPx,
    containerWidthLogicalPx,
    unfilledColor,
  ]);

  return (
    <canvas ref={canvasRef} width={containerWidthLogicalPx} height={containerHeightLogicalPx} />
  );
};

type GlState = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  locs: {
    position: number;
    resolution: WebGLUniformLocation;
    radius: WebGLUniformLocation;
    color: WebGLUniformLocation;
    thickness: WebGLUniformLocation;
    fillHeight: WebGLUniformLocation;
    bkndColor: WebGLUniformLocation;
  };
  buffers: {
    position: WebGLBuffer;
  };
};
