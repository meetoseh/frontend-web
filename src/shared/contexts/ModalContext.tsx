import { createContext, PropsWithChildren, ReactElement, useMemo } from 'react';
import {
  Callbacks,
  useWritableValueWithCallbacks,
  WritableValueWithCallbacks,
} from '../lib/Callbacks';
import { RenderGuardedComponent } from '../components/RenderGuardedComponent';

export type Modals = { key: string; element: ReactElement }[];

export type ModalContextValue = {
  /**
   * The modals which are currently open, as a stack, so the last one is the one
   * which is currently visible. Each element is associated with a unique key,
   * which can be used to close the modal.
   */
  modals: WritableValueWithCallbacks<Modals>;
};

/**
 * Context which holds the modals which are currently open. It's recommended
 * that the ModalProvider be used to set this context.
 */
export const ModalContext = createContext<ModalContextValue>({
  modals: {
    get: () => {
      throw new Error('uninitialized');
    },
    set: () => {
      throw new Error('uninitialized');
    },
    get callbacks(): Callbacks<undefined> {
      throw new Error('uninitialized');
    },
  },
});

/**
 * Provides a ModalContext to the children. The modals are placed at the end of
 * of the children, so this should be a fairly high-level component. This will
 * not rerender the children when the modals change, though it will rerender
 * all active modals.
 */
export const ModalProvider = ({ children }: PropsWithChildren<object>): ReactElement => {
  const modals = useWritableValueWithCallbacks<Modals>(() => []);
  const memodWrappedModals = useMemo(() => ({ modals }), [modals]);
  return (
    <ModalContext.Provider value={memodWrappedModals}>
      {children}
      <RenderGuardedComponent
        props={modals}
        component={(modals) => (
          <>
            {modals.map((m) => (
              <div key={m.key}>{m.element}</div>
            ))}
          </>
        )}
      />
    </ModalContext.Provider>
  );
};

/**
 * Convenience method that adds the given modal to the list of modals, returning
 * a function that can be called to remove the modal. This is typically the bulk
 * of the work required in a useEffect for a modal.
 *
 * @param setModals The setModals from the ModalContext
 * @param element The element to add to the modals
 * @returns A function that can be called to remove the modal
 */
export const addModalWithCallbackToRemove = (
  modalsVWC: WritableValueWithCallbacks<Modals>,
  element: ReactElement
): ((this: void) => void) => {
  const uid = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  modalsVWC.set([
    ...modalsVWC.get(),
    {
      key: uid,
      element: element,
    },
  ]);
  modalsVWC.callbacks.call(undefined);

  return () => {
    modalsVWC.set(modalsVWC.get().filter((modal) => modal.key !== uid));
    modalsVWC.callbacks.call(undefined);
  };
};
