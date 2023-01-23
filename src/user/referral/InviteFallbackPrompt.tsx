import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { LoginContextValue } from '../../shared/LoginContext';
import { SettingsForceDelete } from '../settings/Settings';
import { getDailyEventInvite } from './lib/getDailyEventInvite';
import { NewUserDailyEventInvite } from './models/NewUserDailyEventInvite';
import styles from './InviteFallbackPrompt.module.css';

export const InviteFallbackPrompt = ({
  loginContext,
  onCancel,
  initialInvite,
}: {
  loginContext: LoginContextValue;
  onCancel: (this: void) => void;
  initialInvite: NewUserDailyEventInvite | null;
}): ReactElement => {
  const [invite, setInvite] = useState<NewUserDailyEventInvite | null>(initialInvite);
  const [error, setError] = useState<ReactElement | null>(null);
  const [justCopied, setJustCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetchInvite();
    return () => {
      active = false;
    };

    async function fetchInvite() {
      if (loginContext.state !== 'logged-in') {
        return;
      }

      if (invite !== null) {
        return;
      }

      try {
        const inv = await getDailyEventInvite({ loginContext, journeyUid: null });
        if (active) {
          setInvite(inv);
        }
      } catch (e) {
        if (!active) {
          return;
        }
        console.error(e);
        setError(await describeError(e));
      }
    }
  }, [loginContext, invite]);

  const inviteMessage: ReactElement | string | null = useMemo(() => {
    if (invite === null) {
      return null;
    }

    if (invite.isPlusLink) {
      return (
        <div className={styles.inviteText}>
          Use the following URL to invite friends and they will get Oseh+ for 24 hours, for free:{' '}
          <a href={invite.url} className={styles.inviteTextURL}>
            {invite.url}
          </a>
        </div>
      );
    }

    return (
      <div className={styles.inviteText}>
        Use the following URL to invite friends:{' '}
        <a href={invite.url} className={styles.inviteTextURL}>
          {invite.url}
        </a>
        <div className={styles.inviteUpsellText}>
          If you get Oseh+ then anyone who uses this link today can choose their journey.{' '}
          <a href="/upgrade" className={styles.inviteUpsellLink}>
            Upgrade Now
          </a>
          .
        </div>
      </div>
    );
  }, [invite]);

  const onConfirm = useCallback(async () => {
    if (invite === null) {
      return;
    }

    if (!(window.navigator && navigator.clipboard && navigator.clipboard.writeText)) {
      console.error('detected missing clipboard support');
      setError(<>Sorry, your browser does not support copying to the clipboard.</>);
      return;
    }

    try {
      await navigator.clipboard.writeText(invite.url);
      setJustCopied(true);
      setTimeout(() => {
        setJustCopied(false);
      }, 2000);
    } catch (e) {
      console.error(e);
      setError(<>Sorry, we were unable to copy to the clipboard.</>);
    }
  }, [invite]);

  return (
    <SettingsForceDelete
      title="Invite Friends"
      body={
        <>
          {invite === null || inviteMessage === null ? (
            <>Loading invite...</>
          ) : (
            <>{inviteMessage}</>
          )}
          {error !== null ? <ErrorBlock>{error}</ErrorBlock> : null}
        </>
      }
      cta={justCopied ? 'Copied' : 'Copy URL'}
      confirmDisabled={justCopied}
      onConfirm={onConfirm}
      onCancel={onCancel}
      cancelCta={invite === null ? 'Cancel' : 'Done'}
    />
  );
};
