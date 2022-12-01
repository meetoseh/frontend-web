import { ReactElement } from 'react';
import { LoginButton } from '../shared/LoginButton';
import { LoginProvider } from '../shared/LoginContext';
import { MyProfilePicture } from '../shared/MyProfilePicture';
import { AdminViewContentFile } from './AdminViewContentFile';
import { AdminViewImageFile } from './AdminViewImageFile';
import { JourneyAudioContentUpload } from './JourneyAudioContentUpload';
import { JourneyBackgroundImageUpload } from './JourneyBackgroundImageUpload';
import '../assets/fonts.css';

export default function AdminApp(): ReactElement {
  return (
    <LoginProvider>
      <div style={{ padding: '24px', fontFamily: 'Open Sans', fontSize: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <MyProfilePicture /> AdminApp!
        </div>
        <LoginButton />
        <div>
          <a href="/admin/dev_journey">Dev Journey</a>
        </div>
        <JourneyBackgroundImageUpload />
        <JourneyAudioContentUpload />
        <AdminViewImageFile />
        <AdminViewContentFile />
      </div>
    </LoginProvider>
  );
}
