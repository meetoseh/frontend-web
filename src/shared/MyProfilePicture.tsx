import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from './ApiConstants';
import { LoginContext, LoginContextValue } from './LoginContext';
import { OsehImage, OsehImageRef, OsehImageState, useOsehImageState } from './OsehImage';

type MyProfilePictureProps = {
  /**
   * Desired display width
   * @default 60
   */
  displayWidth?: number;

  /**
   * Desired display height
   * @default 60
   */
  displayHeight?: number;

  /**
   * If specified, this function will be called with true if the image is
   * available and false if not.
   *
   * @param available If the image is available
   */
  setAvailable?: ((available: boolean) => void) | null;
};
/**
 * Shows the users profile picture as a 60x60 image. Requires a login
 * context.
 *
 * Shows a blank image if the user is not logged in or do not have a
 * profile picture.
 */
export const MyProfilePicture = ({
  displayWidth = 60,
  displayHeight = 60,
  setAvailable = null,
}: MyProfilePictureProps): ReactElement => {
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
          if (retryCounter < 1) {
            setTimeout(getImageRef.bind(undefined, retryCounter + 1), 10000);
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

  useEffect(() => {
    setAvailable?.(!!profileImage);
  }, [profileImage, setAvailable]);

  return (
    <>
      {profileImage && (
        <OsehImage
          uid={profileImage.uid}
          jwt={profileImage.jwt}
          displayWidth={displayWidth}
          displayHeight={displayHeight}
          alt="Profile picture"
        />
      )}
    </>
  );
};

type MyProfilePictureStateProps = {
  /**
   * The current login context; profile pictures are always unavailable
   * when not logged in.
   */
  loginContext: LoginContextValue;

  /**
   * Desired display width of the image
   */
  displayWidth: number;

  /**
   * Desired display height of the image
   */
  displayHeight: number;
};

export type MyProfilePictureState =
  | { state: 'loading' | 'unavailable'; image: null }
  | { state: 'available'; image: OsehImageState };
/**
 * Acts as a react hook for finding, selecting, and downloading the
 * current users profile picture.
 *
 * @returns The current state of the profile picture
 */
export const useMyProfilePictureState = ({
  loginContext,
  displayWidth,
  displayHeight,
}: MyProfilePictureStateProps): MyProfilePictureState => {
  const [imgRef, setImgRef] = useState<{ sub: string; img: OsehImageRef } | null>(null);
  const [loadingImageRefFailed, setLoadingImageRefFailed] = useState<string | null>(null);
  const imgArgs = useMemo(
    () => ({
      uid: imgRef?.img?.uid ?? null,
      jwt: imgRef?.img?.jwt ?? null,
      displayWidth,
      displayHeight,
      alt: 'Profile',
    }),
    [imgRef?.img?.uid, imgRef?.img?.jwt, displayWidth, displayHeight]
  );
  const img = useOsehImageState(imgArgs);

  useEffect(() => {
    if (loginContext.state !== 'logged-in') {
      setImgRef(null);
      return;
    }

    const userSub = loginContext.userAttributes!.sub;

    if (imgRef !== null && imgRef.sub === userSub) {
      return;
    }

    if (loadingImageRefFailed !== null && loadingImageRefFailed === userSub) {
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

      try {
        const response = await apiFetch('/api/1/users/me/picture', {}, loginContext);
        if (!active) {
          return;
        }
        if (!response.ok) {
          if (response.status === 404) {
            const data = await response.json();
            if (data.type !== 'not_available' && retryCounter < 2) {
              setTimeout(getImageRef.bind(undefined, retryCounter + 1), 2500);
            } else {
              setLoadingImageRefFailed(userSub);
            }
            return;
          }

          const text = await response.text();
          if (!active) {
            return;
          }
          console.error("Couldn't fetch profile picture", response, text);
          setLoadingImageRefFailed(userSub);
          return;
        }

        const data: OsehImageRef = await response.json();
        if (!active) {
          return;
        }
        setImgRef({ sub: loginContext.userAttributes!.sub, img: data });
      } catch (e) {
        console.error("Couldn't fetch profile picture", e);
        setImgRef(null);
        setLoadingImageRefFailed(userSub);
      }
    }
  }, [loginContext, imgRef, loadingImageRefFailed]);

  return useMemo(() => {
    if (loadingImageRefFailed) {
      return { state: 'unavailable', image: null };
    }

    if (imgRef === null || img.loading) {
      return { state: 'loading', image: null };
    }

    return { state: 'available', image: img };
  }, [imgRef, img, loadingImageRefFailed]);
};
