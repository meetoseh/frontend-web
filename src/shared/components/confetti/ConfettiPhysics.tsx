import { Callbacks } from '../../lib/Callbacks';
import { CancelablePromise } from '../../lib/CancelablePromise';
import { constructCancelablePromise } from '../../lib/CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from '../../lib/createCancelablePromiseFromCallbacks';

type ArrayHole = {
  /** The index of the first item in the hole */
  index: number;
  /** The number of consecutive items, including index, which are empty */
  width: number;
  next: ArrayHole | null;
};

export class ConfettiPhysics {
  readonly wind: { x: number; y: number };
  readonly box: { left: number; top: number; width: number; height: number };

  /** Invoked once after each tick */
  readonly callbacks: Callbacks<undefined>;

  /*
   * Indices which don't actually correspond to confetti; ascending order
   */
  holes: ArrayHole | null;

  widths: number[];
  heights: number[];
  longAxisLengths: number[];
  borderRadii: number[];
  colors: string[];
  rotationXs: number[];
  rotationYs: number[];
  rotationZs: number[];
  xs: number[];
  ys: number[];

  velocityXs: number[];
  velocityYs: number[];

  accelerationXs: number[];
  accelerationYs: number[];

  velocityRotationXs: number[];
  velocityRotationYs: number[];
  velocityRotationZs: number[];

  constructor(
    wind: { x: number; y: number },
    box: { left: number; top: number; width: number; height: number },
    capacity: number
  ) {
    this.wind = wind;
    this.box = box;
    this.callbacks = new Callbacks();

    this.holes = { index: 0, width: capacity, next: null };

    this.widths = Array(capacity).fill(0);
    this.heights = Array(capacity).fill(0);
    this.longAxisLengths = Array(capacity).fill(0);
    this.borderRadii = Array(capacity).fill(0);
    this.colors = Array(capacity).fill('#333333');
    this.rotationXs = Array(capacity).fill(0);
    this.rotationYs = Array(capacity).fill(0);
    this.rotationZs = Array(capacity).fill(0);
    this.xs = Array(capacity).fill(0);
    this.ys = Array(capacity).fill(0);
    this.velocityXs = Array(capacity).fill(0);
    this.velocityYs = Array(capacity).fill(0);
    this.accelerationXs = Array(capacity).fill(0);
    this.accelerationYs = Array(capacity).fill(0);
    this.velocityRotationXs = Array(capacity).fill(0);
    this.velocityRotationYs = Array(capacity).fill(0);
    this.velocityRotationZs = Array(capacity).fill(0);
  }

  /** Returns the number of confetti we can simulate */
  get capacity() {
    return this.widths.length;
  }

  /** Returns true if there is capacity for more confetti, false otherwise */
  get hasSpace() {
    return this.holes !== null;
  }

  /** Adds a new confetti */
  spawnConfetti(
    width: number,
    height: number,
    borderRadius: number,
    color: string,
    x: number,
    y: number,
    rotationX: number,
    rotationY: number,
    rotationZ: number,
    velocityX: number,
    velocityY: number,
    accelerationX: number,
    accelerationY: number,
    velocityRotationX: number,
    velocityRotationY: number,
    velocityRotationZ: number
  ) {
    if (this.holes === null) {
      throw new Error('No more space for confetti');
    }

    const idx = this.holes.index;
    if (this.holes.width > 1) {
      this.holes.index++;
      this.holes.width--;
    } else {
      this.holes = this.holes.next;
    }

    this.widths[idx] = width;
    this.heights[idx] = height;
    this.longAxisLengths[idx] = Math.sqrt(width * width + height * height);
    this.borderRadii[idx] = borderRadius;
    this.colors[idx] = color;
    this.xs[idx] = x;
    this.ys[idx] = y;
    this.rotationXs[idx] = rotationX;
    this.rotationYs[idx] = rotationY;
    this.rotationZs[idx] = rotationZ;
    this.velocityXs[idx] = velocityX;
    this.velocityYs[idx] = velocityY;
    this.accelerationXs[idx] = accelerationX;
    this.accelerationYs[idx] = accelerationY;
    this.velocityRotationXs[idx] = velocityRotationX;
    this.velocityRotationYs[idx] = velocityRotationY;
    this.velocityRotationZs[idx] = velocityRotationZ;
  }

  /**
   * Removes the confetti at the given index. Assumes that the index
   * is valid and not already in the list of holes, otherwise corrupts
   * the holes list
   */
  removeConfetti(idx: number) {
    this.widths[idx] = 0;

    if (this.holes === null) {
      this.holes = { index: idx, width: 1, next: null };
      return;
    }

    let prev: ArrayHole | null = null;
    let current: ArrayHole | null = this.holes;
    while (current !== null) {
      if (current.index + current.width === idx) {
        current.width++;
        return;
      }

      if (current.index === idx + 1) {
        current.index--;
        current.width++;
        return;
      }

      if (current.index > idx) {
        break;
      }

      prev = current;
      current = current.next;
    }

    if (prev === null) {
      this.holes = { index: idx, width: 1, next: current };
    } else {
      prev.next = { index: idx, width: 1, next: current };
    }
  }

  /** Simulates the given amount of time in seconds */
  simulate(dt: number) {
    addScaled(this.velocityXs, this.accelerationXs, dt);
    addScaled(this.velocityYs, this.accelerationYs, dt);

    addConstant(this.accelerationXs, this.wind.x * dt);
    addConstant(this.accelerationYs, this.wind.y * dt);

    addScaled(this.xs, this.velocityXs, dt);
    addScaled(this.ys, this.velocityYs, dt);

    addScaled(this.rotationXs, this.velocityRotationXs, dt);
    addScaled(this.rotationYs, this.velocityRotationYs, dt);
    addScaled(this.rotationZs, this.velocityRotationZs, dt);

    this.cleanupOOB();
    this.callbacks.call(undefined);
  }

  /** Marks any out of bounds particles as gone */
  cleanupOOB() {
    const cap = this.capacity;
    const boxRight = this.box.left + this.box.width;
    const boxBottom = this.box.top + this.box.height;
    for (let i = 0; i < cap; i++) {
      if (
        this.widths[i] !== 0 &&
        (this.xs[i] + this.longAxisLengths[i] < this.box.left ||
          this.xs[i] > boxRight ||
          this.ys[i] + this.longAxisLengths[i] < this.box.top ||
          this.ys[i] > boxBottom)
      ) {
        this.removeConfetti(i);
      }
    }
  }

  /** Starts automatic ticking, with a function to cancel */
  autoTick(): () => void {
    let active = true;
    requestAnimationFrame(init);
    const me = this;
    return () => {
      active = false;
    };

    function init(lastTick: DOMHighResTimeStamp) {
      if (!active) {
        return;
      }

      requestAnimationFrame(tick);
      function tick(now: DOMHighResTimeStamp) {
        if (!active) {
          return;
        }

        const dt = now - lastTick;
        lastTick = now;
        me.simulate(dt / 1000);
        requestAnimationFrame(tick);
      }
    }
  }

  /**
   * Spawns confetti according to the given parameters until the spawn
   * chance reaches 0 or the promise is cancelled. Skips spawns when there
   * is no capacity.
   */
  autoSpawn({
    position,
    velocity,
    acceleration,
    rotation,
    rotationVelocity,
    /** Poisson distribution, spawn chance expressed in number of spawns per second */
    spawnChance,
    spawnChanceVelocity,
  }: {
    position: { x: { min: number; max: number }; y: { min: number; max: number } };
    velocity: { x: { min: number; max: number }; y: { min: number; max: number } };
    acceleration: { x: { min: number; max: number }; y: { min: number; max: number } };
    rotation: {
      x: { min: number; max: number };
      y: { min: number; max: number };
      z: { min: number; max: number };
    };
    rotationVelocity: {
      x: { min: number; max: number };
      y: { min: number; max: number };
      z: { min: number; max: number };
    };
    spawnChance: number;
    spawnChanceVelocity: number;
  }): CancelablePromise<void> {
    if (spawnChance <= 0) {
      return {
        promise: Promise.resolve(),
        cancel: () => {},
        done: () => true,
      };
    }

    const me = this;
    return constructCancelablePromise({
      body: async (state, resolve, reject) => {
        const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
        canceled.promise.catch(() => {});
        if (state.finishing) {
          canceled.cancel();
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        let resolveDone = () => {};
        const done = new Promise<void>((r) => {
          resolveDone = r;
        });

        let lastSpawn = performance.now();
        const spawn = (at: number) => {
          if (state.finishing) {
            resolveDone();
            return;
          }

          const dt = at - lastSpawn;
          lastSpawn = at;

          const lambda = (spawnChance * dt) / 1000;
          const spawns = samplePoisson(lambda);

          for (let i = 0; i < spawns; i++) {
            if (!me.hasSpace) {
              break;
            }

            const width = 5 + Math.random() * 10;
            const isCircle = Math.random() < 0.3;

            const height = isCircle ? width : 5 + Math.random() * 10;
            const borderRadius = isCircle ? width : 0;
            const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
            const x = sample(position.x.min, position.x.max);
            const y = sample(position.y.min, position.y.max);
            const rotationX = sample(rotation.x.min, rotation.x.max);
            const rotationY = sample(rotation.y.min, rotation.y.max);
            const rotationZ = sample(rotation.z.min, rotation.z.max);
            const velocityX = sample(velocity.x.min, velocity.x.max);
            const velocityY = sample(velocity.y.min, velocity.y.max);
            const accelerationX = sample(acceleration.x.min, acceleration.x.max);
            const accelerationY = sample(acceleration.y.min, acceleration.y.max);
            const velocityRotationX = sample(rotationVelocity.x.min, rotationVelocity.x.max);
            const velocityRotationY = sample(rotationVelocity.y.min, rotationVelocity.y.max);
            const velocityRotationZ = sample(rotationVelocity.z.min, rotationVelocity.z.max);
            me.spawnConfetti(
              width,
              height,
              borderRadius,
              color,
              x,
              y,
              rotationX,
              rotationY,
              rotationZ,
              velocityX,
              velocityY,
              accelerationX,
              accelerationY,
              velocityRotationX,
              velocityRotationY,
              velocityRotationZ
            );
          }

          spawnChance += (spawnChanceVelocity * dt) / 1000;
          if (spawnChance <= 0) {
            resolveDone();
            return;
          }

          requestAnimationFrame(spawn);
        };
        requestAnimationFrame(spawn);

        await Promise.race([canceled.promise, done]);

        if (state.finishing) {
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        canceled.cancel();
        state.finishing = true;
        state.done = true;
        resolve();
      },
    });
  }
}

/** Mutates a in place, adding b * scale */
const addScaled = (a: number[], b: number[], scale: number) => {
  for (let i = 0; i < a.length; i++) {
    a[i] += b[i] * scale;
  }
};

/** Mutates a in place, adding value */
const addConstant = (a: number[], value: number) => {
  for (let i = 0; i < a.length; i++) {
    a[i] += value;
  }
};

/** Samples from a Poisson distribution with the given variate */
const samplePoisson = (lambda: number) => {
  let result = 0;
  const fixed = Math.floor(lambda);
  for (let i = 0; i < fixed; i++) {
    result += samplePoisson1();
  }
  if (fixed < lambda) {
    result += samplePoissonLT1(lambda - fixed);
  }
  return result;
};

/** Samples from a Poisson distribution with variate less than 1 */
const samplePoissonLT1 = (lambda: number) => {
  const n = samplePoisson1();
  let result = 0;
  for (let i = 0; i < n; i++) {
    if (Math.random() < lambda) {
      result++;
    }
  }
  return result;
};

/** Samples from the poisson distribution with variate 1 */
// https://stats.stackexchange.com/a/551576
const samplePoisson1 = () => {
  // no idea why this works
  let ret = 1,
    a = 1,
    b = 0;
  do {
    const j = Math.floor(Math.random() * (a + 1));
    if (j === a + 1) {
      // j should b [0, a]
      continue;
    }

    if (j < a && j < b) {
      return ret;
    }

    if (j === a) {
      ret++;
    } else {
      ret -= 1;
      b = a + 1;
    }
    a++;
  } while (true);
};

const sample = (min: number, max: number) => min + Math.random() * (max - min);
