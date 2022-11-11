import { ReactElement } from 'react';
import { LoginButton } from '../shared/LoginButton';
import { LoginProvider } from '../shared/LoginContext';
import { MyProfilePicture } from '../shared/MyProfilePicture';
import { AdminViewImageFile } from './AdminViewImageFile';
import { JourneyBackgroundImageUpload } from './JourneyBackgroundImageUpload';

export default function AdminApp(): ReactElement {
  return (
    <LoginProvider>
      <div style={{ padding: '24px' }}>
        <MyProfilePicture />
        AdminApp! <LoginButton />
        <JourneyBackgroundImageUpload />
        <AdminViewImageFile />
      </div>
    </LoginProvider>
  );
}
