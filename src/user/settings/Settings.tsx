import { useCallback, useContext, useEffect, useState } from 'react';
import { ErrorBlock } from '../../shared/forms/ErrorBlock';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { LoginContext } from '../../shared/LoginContext';
import { addModalWithCallbackToRemove, ModalContext } from '../../shared/ModalContext';
import { ModalWrapper } from '../../shared/ModalWrapper';
import '../../assets/fonts.css';
import styles from './Settings.module.css';
import assistiveStyles from '../../shared/assistive.module.css';

/**
 * Shows a basic settings screen for the user. Requires a login context and a modal
 * context.
 */
export const Settings = () => {
  const [showNotYetImplementedPrompt, setShowNotYetImplementedPrompt] = useState(false);
  const modalContext = useContext(ModalContext);
  const loginContext = useContext(LoginContext);
  const windowSize = useWindowSize();

  const boundShowNotYetImplemented = useCallback(() => {
    setShowNotYetImplementedPrompt(true);
  }, []);

  useEffect(() => {
    if (!showNotYetImplementedPrompt) {
      return;
    }

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper onClosed={() => setShowNotYetImplementedPrompt(false)}>
        <ErrorBlock>That's not implemented yet, but we're working on it!</ErrorBlock>
      </ModalWrapper>
    );
  }, [showNotYetImplementedPrompt, modalContext.setModals]);

  useEffect(() => {
    if (loginContext.state === 'logged-out') {
      window.location.href = '/';
    }
  }, [loginContext.state]);

  return (
    <div className={styles.container} style={{ minHeight: `${windowSize.height}px` }}>
      <div className={styles.closeButtonContainer}>
        <div className={styles.closeButtonInnerContainer}>
          <a href="/" className={styles.close}>
            <div className={styles.closeIcon} />
            <div className={assistiveStyles.srOnly}>Close</div>
          </a>
        </div>
      </div>
      <div className={styles.content}>
        <div className={styles.bigLinks}>
          <div className={styles.bigLinkContainer}>
            <button type="button" className={styles.bigLink} onClick={boundShowNotYetImplemented}>
              Invite Friends
            </button>
          </div>
          <div className={styles.bigLinkContainer}>
            <button type="button" className={styles.bigLink} onClick={boundShowNotYetImplemented}>
              Upgrade to Oseh+
            </button>
          </div>
          <div className={styles.bigLinkContainer}>
            <button type="button" className={styles.bigLink} onClick={boundShowNotYetImplemented}>
              Contact Support
            </button>
          </div>
          <div className={styles.bigLinkContainer}>
            <button type="button" className={styles.bigLink} onClick={boundShowNotYetImplemented}>
              Restore Purchase
            </button>
          </div>
          <div className={styles.bigLinkContainer}>
            <button type="button" className={styles.bigLink} onClick={boundShowNotYetImplemented}>
              Delete Account
            </button>
          </div>
        </div>
        <div className={styles.smallLinks}>
          <div className={styles.smallLinkContainer}>
            <button type="button" className={styles.smallLink} onClick={boundShowNotYetImplemented}>
              Privacy Policy
            </button>
          </div>

          <div className={styles.smallLinkContainer}>
            <button type="button" className={styles.smallLink} onClick={boundShowNotYetImplemented}>
              Terms & Conditions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
