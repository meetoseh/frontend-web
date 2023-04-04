import { MutableRefObject, ReactElement, useEffect, useMemo, useRef } from 'react';
import { Bezier, ease as defaultEase } from '../lib/Bezier';
import { BezierAnimation, animIsComplete, calculateAnimValue } from '../lib/BezierAnimation';
import { Callbacks } from '../lib/Callbacks';
import { createCancelablePromiseFromCallbacks } from '../lib/createCancelablePromiseFromCallbacks';
import { useSimpleImage } from '../hooks/useSimpleImage';
import { createCancelableTimeout } from '../lib/createCancelableTimeout';

type ImageCrossFadeProps = {
  /**
   * The url of the image to fade from
   */
  from: string;

  /**
   * The url of the image to fade to
   */
  to: string;

  /**
   * The width to render both images at, in logical pixels
   */
  width: number;

  /**
   * The height to render both images at, in logical pixels.
   */
  height: number;

  /**
   * The animation easing to use. Defaults to the standard ease
   */
  ease?: Bezier;

  /**
   * The duration of the animation in milliseconds. Defaults to 350ms
   */
  duration?: number;

  /**
   * If specified, the animation is delayed this number of milliseconds
   * prior to starting. Defaults to 0ms
   */
  delay?: number;

  /**
   * If set to true, the delay is not reduced and the animation does not
   * progress. Defaults to false
   */
  paused?: boolean;

  /**
   * If specified, called when the animation starts. Note that pausing
   * after this and then unpausing will not cause this to be called again.
   */
  onStart?: () => void;

  /**
   * If specified, called when the animation finishes. Note that pausing
   * after this and then unpausing will not cause this to be called again.
   */
  onFinish?: () => void;
};

/**
 * Cross fades from the source to the target image, then stays on the target. This
 * is primarily intended for fading between svgs and hence operates directly on image
 * urls rather than oseh images, though the local url of an oseh image can be used.
 *
 * This component is written to be easily adapted to React Native, hence prefers
 * webgl to css transitions.
 */
export const ImageCrossFade = ({
  from,
  to,
  width,
  height,
  ease = defaultEase,
  duration = 350,
  delay = 0,
  paused = false,
  onStart,
  onFinish,
}: ImageCrossFadeProps): ReactElement => {
  const fromImage = useSimpleImage({ url: from, width, height });
  const toImage = useSimpleImage({ url: to, width, height });

  const locked = useRef<boolean>(false);
  const lockedCallback = useRef<Callbacks<undefined>>() as MutableRefObject<Callbacks<undefined>>;

  if (lockedCallback.current === undefined) {
    lockedCallback.current = new Callbacks<undefined>();
  }

  const delayRemaining = useRef<number>(delay);
  const msIntoAnimation = useRef<number>(0);
  const calledStarted = useRef<boolean>(false);
  const calledFinished = useRef<boolean>(false);

  const onStartedRef = useRef(onStart);
  const onFinishedRef = useRef(onFinish);

  onStartedRef.current = onStart;
  onFinishedRef.current = onFinish;

  useEffect(() => {
    if (canvasRef.current === null || fromImage.image === null || toImage.image === null) {
      return;
    }

    const canvas = canvasRef.current;
    let active = true;
    const cancelers = new Callbacks<undefined>();
    acquireLockAndHandle();
    return () => {
      if (active) {
        active = false;
        cancelers.call(undefined);
      }
    };

    async function acquireLockAndHandle() {
      while (locked.current) {
        if (!active) {
          return;
        }

        const canceled = createCancelablePromiseFromCallbacks(cancelers);
        const prevUnmounted = createCancelablePromiseFromCallbacks(lockedCallback.current);
        await Promise.race([canceled.promise, prevUnmounted.promise]);
        canceled.cancel();
        prevUnmounted.cancel();
      }

      locked.current = true;
      handle();
    }

    function releaseLock() {
      locked.current = false;
      lockedCallback.current.call(undefined);
    }

    async function handle() {
      const initialDelayRemaining = delayRemaining.current;
      const initialMsIntoAnimation = msIntoAnimation.current;

      const gfx = initGraphics();
      render(gfx, ease.b_t(Math.min(initialMsIntoAnimation / duration, 1.0))[1]);

      if (paused) {
        cancelers.add(() => {
          gfx.dispose();
          releaseLock();
        });
        return;
      }

      if (initialDelayRemaining > 0) {
        let startedAt = Date.now();
        const delayFinished = createCancelableTimeout(initialDelayRemaining);
        const canceled = createCancelablePromiseFromCallbacks(cancelers);
        await Promise.race([delayFinished.promise, canceled.promise]);
        delayFinished.cancel();
        canceled.cancel();
        delayRemaining.current = Math.max(0, initialDelayRemaining - (Date.now() - startedAt));
        if (!active) {
          gfx.dispose();
          releaseLock();
          return;
        }
      }

      if (!calledStarted.current) {
        onStartedRef.current?.();
        calledStarted.current = true;
      }

      if (initialMsIntoAnimation < duration) {
        playAnimation(gfx, initialMsIntoAnimation);
      } else {
        if (!calledFinished.current) {
          onFinishedRef.current?.();
          calledFinished.current = true;
        }

        cancelers.add(() => {
          gfx.dispose();
          releaseLock();
        });
      }
    }

    function playAnimation(gfx: RenderState, initialMsIntoAnimation: number) {
      const animation: BezierAnimation = {
        from: 0,
        to: 1,
        startedAt: null,
        ease,
        duration,
      };

      const startedAt = Date.now();

      const onFrame = (now: DOMHighResTimeStamp) => {
        if (!active) {
          let timeSpentAnimating = Date.now() - startedAt;
          msIntoAnimation.current = Math.min(initialMsIntoAnimation + timeSpentAnimating, duration);
          gfx.dispose();
          releaseLock();
          return;
        }

        if (animation.startedAt === null) {
          animation.startedAt = now - initialMsIntoAnimation;
        }

        const progress = calculateAnimValue(animation, now);
        render(gfx, progress);

        if (animIsComplete(animation, now)) {
          if (!calledFinished.current) {
            onFinishedRef.current?.();
            calledFinished.current = true;
          }

          cancelers.add(() => {
            gfx.dispose();
            releaseLock();
          });
        } else {
          requestAnimationFrame(onFrame);
        }
      };

      requestAnimationFrame(onFrame);
    }

    function render(gfx: RenderState, progress: number) {
      const gl = gfx.gl;

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(gfx.program);

      gl.enableVertexAttribArray(gfx.attribLocations.position);
      gl.bindBuffer(gl.ARRAY_BUFFER, gfx.buffers.position);
      gl.vertexAttribPointer(gfx.attribLocations.position, 2, gl.FLOAT, false, 0, 0);

      gl.enableVertexAttribArray(gfx.attribLocations.textureCoord);
      gl.bindBuffer(gl.ARRAY_BUFFER, gfx.buffers.textureCoord);
      gl.vertexAttribPointer(gfx.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(gfx.uniformLocations.resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1i(gfx.uniformLocations.fromSampler, gfx.textures.from.unit);
      gl.uniform1i(gfx.uniformLocations.toSampler, gfx.textures.to.unit);
      gl.uniform1f(gfx.uniformLocations.progress, progress);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disableVertexAttribArray(gfx.attribLocations.position);
      gl.disableVertexAttribArray(gfx.attribLocations.textureCoord);
      gl.flush();
    }

    function initGraphics(): RenderState {
      const gl = canvas.getContext('webgl');
      if (gl === null) {
        throw new Error('Could not get webgl context');
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
        attribute vec2 a_texcoord;

        uniform vec2 u_resolution;

        varying vec2 v_texcoord;

        void main(void) {
          gl_Position = vec4((a_position / u_resolution) * 2.0 - 1.0, 0.0, 1.0);
          v_texcoord = a_texcoord;
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

        uniform sampler2D u_fromSampler;
        uniform sampler2D u_toSampler;
        uniform float u_progress;

        varying vec2 v_texcoord;

        void main(void) {
          vec4 fromColor = texture2D(u_fromSampler, v_texcoord);
          vec4 toColor = texture2D(u_toSampler, v_texcoord);

          gl_FragColor = vec4(mix(fromColor.rgb, toColor.rgb, u_progress), 1.0) * mix(fromColor.a, toColor.a, u_progress);
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

      const texcoordBuffer = gl.createBuffer();
      if (texcoordBuffer === null) {
        throw new Error('Failed to create texcoord buffer');
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
        gl.STATIC_DRAW
      );

      const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
      if (resolutionLocation === null) {
        throw new Error('Failed to get resolution location');
      }

      const fromSamplerLocation = gl.getUniformLocation(program, 'u_fromSampler');
      if (fromSamplerLocation === null) {
        throw new Error('Failed to get fromSampler location');
      }

      const toSamplerLocation = gl.getUniformLocation(program, 'u_toSampler');
      if (toSamplerLocation === null) {
        throw new Error('Failed to get toSampler location');
      }

      const progressLocation = gl.getUniformLocation(program, 'u_progress');
      if (progressLocation === null) {
        throw new Error('Failed to get progress location');
      }

      const positionLocation = gl.getAttribLocation(program, 'a_position');
      if (positionLocation === -1) {
        throw new Error('Failed to get position location');
      }

      const texcoordLocation = gl.getAttribLocation(program, 'a_texcoord');
      if (texcoordLocation === -1) {
        throw new Error('Failed to get texcoord location');
      }

      gl.activeTexture(gl.TEXTURE0);
      const fromTexture = gl.createTexture();
      if (fromTexture === null) {
        throw new Error('Failed to create from texture');
      }
      gl.bindTexture(gl.TEXTURE_2D, fromTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fromImage.image!);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

      gl.activeTexture(gl.TEXTURE1);
      const toTexture = gl.createTexture();
      if (toTexture === null) {
        throw new Error('Failed to create to texture');
      }
      gl.bindTexture(gl.TEXTURE_2D, toTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, toImage.image!);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

      return {
        gl,
        program,
        canvas,
        attribLocations: {
          position: positionLocation,
          textureCoord: texcoordLocation,
        },
        uniformLocations: {
          resolution: resolutionLocation,
          fromSampler: fromSamplerLocation,
          toSampler: toSamplerLocation,
          progress: progressLocation,
        },
        buffers: {
          position: positionBuffer,
          textureCoord: texcoordBuffer,
        },
        textures: {
          from: { unit: 0, val: fromTexture },
          to: { unit: 1, val: toTexture },
        },
        dispose: () => {
          gl.deleteTexture(fromTexture);
          gl.deleteTexture(toTexture);
          gl.deleteBuffer(positionBuffer);
          gl.deleteBuffer(texcoordBuffer);
          gl.deleteProgram(program);
        },
      };
    }
  }, [fromImage, toImage, duration, ease, paused]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStyle = useMemo(
    () => ({
      transform: `translate(-25%, -25%) scale(${1 / devicePixelRatio})`,
    }),
    []
  );
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
};

type RenderState = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  canvas: HTMLCanvasElement;
  attribLocations: {
    position: number;
    textureCoord: number;
  };
  uniformLocations: {
    resolution: WebGLUniformLocation;
    fromSampler: WebGLUniformLocation;
    toSampler: WebGLUniformLocation;
    progress: WebGLUniformLocation;
  };
  buffers: {
    position: WebGLBuffer;
    textureCoord: WebGLBuffer;
  };
  textures: {
    from: { unit: number; val: WebGLTexture };
    to: { unit: number; val: WebGLTexture };
  };
  dispose: () => void;
};
