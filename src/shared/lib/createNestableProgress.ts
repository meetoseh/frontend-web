import { createWritableValueWithCallbacks, ValueWithCallbacks } from './Callbacks';

export type NestableProgress = {
  /** the current stack */
  current: ValueWithCallbacks<string[]>;
  /** pushes to the end of the stack */
  nest: (value: string) => void;
  /** replaces the last value on the stack */
  replace: (value: string) => void;
  /** pops from the end of the stack */
  pop: () => void;
  /** pushes the value until the inner function completes then pops */
  withNested: <T>(value: string, fn: () => T) => T;
  /** like withNested but when fn returns a promise */
  withNestedAsync: <T>(value: string, fn: () => Promise<T>) => Promise<T>;
};

/**
 * Creates a basic nestable project object, which allows reporting
 * progress at different tiers
 */
export const createNestableProgress = (): NestableProgress => {
  const current = createWritableValueWithCallbacks<string[]>([]);
  return {
    current,
    nest: (value) => {
      current.set([...current.get(), value]);
      current.callbacks.call(undefined);
    },
    replace: (value) => {
      const currentStack = current.get();
      if (currentStack.length === 0) {
        return;
      }

      current.set([...currentStack.slice(0, currentStack.length - 1), value]);
      current.callbacks.call(undefined);
    },
    pop: () => {
      const currentStack = current.get();
      current.set(currentStack.slice(0, currentStack.length - 1));
      current.callbacks.call(undefined);
    },
    withNested: <T>(value: string, fn: () => T): T => {
      current.set([...current.get(), value]);
      current.callbacks.call(undefined);
      try {
        return fn();
      } finally {
        const currentStack = current.get();
        current.set(currentStack.slice(0, currentStack.length - 1));
        current.callbacks.call(undefined);
      }
    },
    withNestedAsync: async <T>(value: string, fn: () => Promise<T>): Promise<T> => {
      current.set([...current.get(), value]);
      current.callbacks.call(undefined);
      try {
        return await fn();
      } finally {
        const currentStack = current.get();
        current.set(currentStack.slice(0, currentStack.length - 1));
        current.callbacks.call(undefined);
      }
    },
  };
};
