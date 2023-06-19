import {
  createContext,
  Dispatch,
  PropsWithChildren,
  ReactElement,
  SetStateAction,
  useState,
} from 'react';

export type Modals = { key: string; element: ReactElement }[];

export type ModalContextValue = {
  /**
   * The modals which are currently open, as a stack, so the last one is the one
   * which is currently visible. Each element is associated with a unique key,
   * which can be used to close the modal.
   */
  modals: Modals;

  /**
   * Sets the modals which are currently open.
   */
  setModals: Dispatch<SetStateAction<Modals>>;
};

/**
 * Context which holds the modals which are currently open. It's recommended
 * that the ModalProvider be used to set this context.
 */
export const ModalContext = createContext<ModalContextValue>({ modals: [], setModals: () => {} });

/**
 * Provides a ModalContext to the children. The modals are placed at the end of
 * of the children, so this should be a fairly high-level component.
 */
export const ModalProvider = ({ children }: PropsWithChildren<object>): ReactElement => {
  const [modals, setModals] = useState<Modals>([]);
  return (
    <ModalContext.Provider value={{ modals, setModals }}>
      {children}
      {modals.map((m) => (
        <div key={m.key}>{m.element}</div>
      ))}
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
  setModals: Dispatch<SetStateAction<Modals>>,
  element: ReactElement
): ((this: void) => void) => {
  const uid = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  setModals((modals) => [
    ...modals,
    {
      key: uid,
      element: element,
    },
  ]);

  return () => {
    setModals((modals) => modals.filter((modal) => modal.key !== uid));
  };
};
