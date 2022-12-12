import { ReactElement, useCallback, useContext } from 'react';
import { Popup } from 'reactjs-popup';
import { MyProfilePicture } from '../../../../shared/MyProfilePicture';
import '../../../../assets/fonts.css';
import styles from './AdminNavDesktopUserSettings.module.css';
import { LoginContext } from '../../../../shared/LoginContext';

export const AdminNavDesktopUserSettings = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const logout = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      event.preventDefault();
      loginContext.setAuthTokens.apply(undefined, [null]);
      window.location.href = '/';
    },
    [loginContext.setAuthTokens]
  );

  return (
    <div className={styles.container}>
      <Popup
        trigger={
          <div className={styles.imageContainer}>
            <MyProfilePicture />
          </div>
        }
        position="bottom left"
        on="hover"
        closeOnDocumentClick
        mouseLeaveDelay={300}
        mouseEnterDelay={0}
        arrow={false}>
        <div className={styles.popupContainer}>
          <button type="button" className={styles.popupItem} onClick={logout}>
            Sign Out
          </button>
        </div>
      </Popup>
    </div>
  );
};
