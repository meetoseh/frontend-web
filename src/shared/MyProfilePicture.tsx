import { ReactElement, useContext, useEffect, useState } from 'react';
import { apiFetch } from './ApiConstants';
import { LoginContext } from './LoginContext';
import { OsehImage, OsehImageRef } from './OsehImage';

/**
 * Shows the users profile picture as a 60x60 image. Requires a login
 * context.
 *
 * Shows a blank image if the user is not logged in or do not have a
 * profile picture.
 */
export const MyProfilePicture = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [profileImage, setProfileImage] = useState<OsehImageRef | null>(null);

  useEffect(() => {
    if (loginContext.state !== 'logged-in') {
      setProfileImage(null);
      return;
    }

    let active = true;
    getImageRef();
    return () => {
      active = false;
    };

    async function getImageRef(retryCounter = 0) {
      if (!active) {
        return;
      }

      const response = await apiFetch('/api/1/users/me/picture', {}, loginContext);
      if (!active) {
        return;
      }
      if (!response.ok) {
        if (response.status === 404) {
          if (retryCounter < 10 && loginContext.userAttributes?.picture) {
            setTimeout(getImageRef.bind(undefined, retryCounter + 1), 1000);
          }
          return;
        }

        const text = await response.text();
        if (!active) {
          return;
        }
        console.error("Couldn't fetch profile picture", response, text);
        return;
      }

      const data: OsehImageRef = await response.json();
      if (!active) {
        return;
      }
      setProfileImage(data);
    }
  }, [loginContext]);

  return (
    <>
      {profileImage && (
        <OsehImage
          uid={profileImage.uid}
          jwt={profileImage.jwt}
          displayWidth={60}
          displayHeight={60}
          alt="Profile picture"
        />
      )}
    </>
  );
};
