/**
 * Describes something which can be used to avoid completely blocking
 * rendering without being as complicated as a full-on web worker
 */
export type MaxWorkPerFrameStaller = {
  /**
   * If too much work has occurred since the last break, delegates to the
   * native ui thread for a bit before resolving
   */
  stall: () => Promise<void>;
  /**
   * Dispose of any resources used by the staller
   */
  dispose: () => void;
};

/**
 * Creates an object that can help spread work over multiple frames
 */
export const createMaxWorkPerFrameStaller = (opts?: {
  maxWorkPerFrameMs?: number;
  initiallyStall?: boolean;
}): MaxWorkPerFrameStaller => {
  const maxWorkPerFrameMs = opts?.maxWorkPerFrameMs ?? 100;
  const initiallyStall = opts?.initiallyStall ?? true;
  let frameStartedAt = performance.now() - (initiallyStall ? maxWorkPerFrameMs : 0);

  return {
    stall: async () => {
      const timeSinceFrameStart = performance.now() - frameStartedAt;
      if (timeSinceFrameStart < maxWorkPerFrameMs) {
        return;
      }

      await new Promise((resolve) => requestAnimationFrame(resolve));
      frameStartedAt = performance.now();
    },
    dispose: () => {},
  };
};
