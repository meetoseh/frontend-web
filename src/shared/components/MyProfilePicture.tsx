import { ReactElement, useContext } from 'react';
import { LoginContext } from '../contexts/LoginContext';
import { OsehImageStateRequestHandler } from '../images/useOsehImageStateRequestHandler';
import { useMyProfilePictureState } from '../hooks/useMyProfilePicture';
import { OsehImageFromState } from '../images/OsehImageFromState';

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
   * The handler to use for loading images
   */
  imageHandler: OsehImageStateRequestHandler;
};

/**
 * Shows the users profile picture as a 45x45 image. Requires a login
 * context. Returns an empty fragment if the user doesn't have a profile
 * picture.
 */
export const MyProfilePicture = ({
  displayWidth = 45,
  displayHeight = 45,
  imageHandler,
}: MyProfilePictureProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const profileImage = useMyProfilePictureState({
    loginContext,
    displayWidth,
    displayHeight,
    handler: imageHandler,
  });

  if (profileImage.state === 'unavailable') {
    return <DefaultProfilePicture displayWidth={displayWidth} displayHeight={displayHeight} />;
  }

  return (
    <>{profileImage.state === 'available' && <OsehImageFromState {...profileImage.image} />}</>
  );
};

export const DefaultProfilePicture = ({ displayWidth = 45, displayHeight = 45 }) => {
  return (
    <svg
      width={`${displayWidth}`}
      height={`${displayHeight}`}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M70.762 65.5138C74.8681 60.5775 77.724 54.7256 79.088 48.4532C80.4519 42.1809 80.2839 35.6725 78.5981 29.4788C76.9123 23.285 73.7583 17.5881 69.4029 12.8699C65.0475 8.15165 59.6188 4.55098 53.5762 2.37244C47.5335 0.193897 41.0546 -0.498415 34.6875 0.354065C28.3205 1.20655 22.2525 3.57874 16.997 7.26998C11.7416 10.9612 7.45318 15.8629 4.49462 21.5604C1.53606 27.2578 -0.00561142 33.5835 1.53471e-05 40.0022C0.00217453 49.3332 3.29307 58.3653 9.29523 65.5138L9.23804 65.5623C9.43818 65.8023 9.66692 66.008 9.87278 66.2451C10.1301 66.5394 10.4074 66.8165 10.6734 67.1022C11.4739 67.9706 12.2974 68.8048 13.1608 69.5876C13.4239 69.8276 13.6955 70.0504 13.9614 70.279C14.8764 71.0675 15.817 71.816 16.792 72.513C16.9178 72.5987 17.0322 72.7101 17.158 72.7987V72.7644C23.8545 77.473 31.8431 80 40.0315 80C48.2199 80 56.2084 77.473 62.9049 72.7644V72.7987C63.0307 72.7101 63.1423 72.5987 63.2709 72.513C64.243 71.8131 65.1866 71.0675 66.1015 70.279C66.3674 70.0504 66.639 69.8247 66.9021 69.5876C67.7656 68.802 68.589 67.9706 69.3896 67.1022C69.6555 66.8165 69.93 66.5394 70.1901 66.2451C70.3932 66.008 70.6247 65.8023 70.8249 65.5595L70.762 65.5138ZM40.0286 17.1475C42.5733 17.1475 45.0609 17.9015 47.1768 19.3141C49.2926 20.7267 50.9417 22.7345 51.9155 25.0836C52.8894 27.4327 53.1442 30.0175 52.6477 32.5113C52.1513 35.0051 50.9259 37.2957 49.1265 39.0937C47.3271 40.8916 45.0345 42.116 42.5387 42.612C40.0429 43.1081 37.4559 42.8535 35.1049 41.8804C32.7539 40.9074 30.7444 39.2597 29.3306 37.1455C27.9169 35.0314 27.1623 32.5459 27.1623 30.0033C27.1623 26.5937 28.5178 23.3238 30.9307 20.9129C33.3436 18.5019 36.6162 17.1475 40.0286 17.1475ZM17.1751 65.5138C17.2247 61.7626 18.7504 58.1819 21.4221 55.5461C24.0937 52.9103 27.6965 51.4315 31.4511 51.4296H48.6062C52.3607 51.4315 55.9635 52.9103 58.6352 55.5461C61.3068 58.1819 62.8325 61.7626 62.8821 65.5138C56.6114 71.1598 48.4697 74.2845 40.0286 74.2845C31.5876 74.2845 23.4458 71.1598 17.1751 65.5138Z"
        fill="#C8CDD0"
      />
    </svg>
  );
};
