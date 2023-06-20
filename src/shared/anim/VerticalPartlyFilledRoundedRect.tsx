// VPFRR = Vertical Partly Filled Rounded Rect

import { ReactElement, useMemo } from 'react';
import {
  SinglePassWebGLComponent,
  SinglePassWebGLComponentRenderer,
} from './SinglePassWebGLComponent';
import {
  Animator,
  BezierAnimator,
  BezierColorAnimator,
  VariableStrategyProps,
  useAnimationLoop,
} from './AnimationLoop';
import { ease } from '../lib/Bezier';

type Props = {
  /**
   * The filled height as a fractional value 0-1
   */
  filledHeight: number;

  /**
   * The border radius in logical pixels.
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
   * Modifies the opacity of all colors linearly; value from 0-1. Convenient
   * for e.g., fading in and out.
   */
  opacity: number;

  /**
   * If specified, a border is drawn around the element.
   */
  border?: {
    /**
     * Width of the border, in logical pixels
     */
    width: number;
  };
};
export type VPFRRProps = Props;

type Attributes = 'position';
type Uniforms = 'resolution' | 'radius' | 'thickness' | 'fillHeight' | 'color' | 'backgroundColor';
type Buffers = 'position';
type Textures = never;

const VPFRRRenderer: SinglePassWebGLComponentRenderer<
  Attributes,
  Uniforms,
  Buffers,
  Textures,
  Props
> = {
  initialize: (canvas) => {
    const gl = canvas.getContext('webgl');
    if (gl === null) {
      throw new Error('WebGL not supported');
    }

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
        bool isTopRightOfCircle = vecCircleCenterToPosition.x >= 0.0 && vecCircleCenterToPosition.y >= 0.0;
        bool isBottomLeftOfCircle = vecCircleCenterToPosition.x < 0.0 && vecCircleCenterToPosition.y < 0.0;
        bool isTopLeftOfCircle = vecCircleCenterToPosition.x < 0.0 && vecCircleCenterToPosition.y > 0.0;
        bool isBottomRightOfCircle = vecCircleCenterToPosition.x >= 0.0 && vecCircleCenterToPosition.y <= 0.0;
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

    return {
      gl,
      program,
      attributes: {
        position: gl.getAttribLocation(program, 'a_position'),
      },
      uniforms: {
        resolution: resolutionLocation,
        radius: radiusLocation,
        color: colorLocation,
        thickness: thicknessLocation,
        fillHeight: fillHeightLocation,
        backgroundColor: bkndColorLocation,
      },
      buffers: {
        position: positionBuffer,
      },
      textures: {},
      dispose: () => {
        gl.deleteBuffer(positionBuffer);
        gl.deleteProgram(program);
      },
    };
  },
  render: (state, props, dpi) => {
    const gl = state.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(state.program);

    gl.enableVertexAttribArray(state.attributes.position);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.buffers.position);
    gl.vertexAttribPointer(state.attributes.position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(state.uniforms.resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(state.uniforms.radius, dpi * props.borderRadius);
    gl.uniform1f(state.uniforms.thickness, dpi * (props.border?.width ?? 0));
    gl.uniform1f(state.uniforms.fillHeight, props.filledHeight * gl.drawingBufferHeight);
    gl.uniform4f(
      state.uniforms.color,
      props.filledColor[0],
      props.filledColor[1],
      props.filledColor[2],
      props.filledColor[3] * props.opacity
    );
    gl.uniform4f(
      state.uniforms.backgroundColor,
      props.unfilledColor[0],
      props.unfilledColor[1],
      props.unfilledColor[2],
      props.unfilledColor[3] * props.opacity
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.disableVertexAttribArray(state.attributes.position);
    gl.flush();
  },
};

export const VerticalPartlyFilledRoundedRect = ({
  props: targetProps,
  width,
  height,
}: {
  props: VariableStrategyProps<Props>;
  width: number;
  height: number;
}): ReactElement => {
  const animators = useMemo<Animator<Props>[]>(
    () => [
      new BezierAnimator(
        ease,
        350,
        (p) => p.filledHeight,
        (p, h) => {
          p.filledHeight = h;
        }
      ),
      new BezierAnimator(
        ease,
        350,
        (p) => p.borderRadius,
        (p, r) => {
          p.borderRadius = r;
        }
      ),
      new BezierColorAnimator(
        ease,
        350,
        (p) => p.unfilledColor,
        (p, c) => {
          p.unfilledColor = c;
        }
      ),
      new BezierColorAnimator(
        ease,
        350,
        (p) => p.filledColor,
        (p, c) => {
          p.filledColor = c;
        }
      ),
      new BezierAnimator(
        ease,
        350,
        (p) => p.opacity,
        (p, o) => {
          p.opacity = o;
        }
      ),
      new BezierAnimator(
        ease,
        350,
        (p) => p.border?.width ?? 0,
        (p, w) => {
          if (p.border === undefined) {
            p.border = { width: w };
          } else {
            p.border.width = w;
          }
        }
      ),
    ],
    []
  );
  const [props, propsChanged] = useAnimationLoop(targetProps, animators);
  return (
    <SinglePassWebGLComponent
      renderer={VPFRRRenderer}
      props={props}
      propsChanged={propsChanged}
      width={width}
      height={height}
    />
  );
};
