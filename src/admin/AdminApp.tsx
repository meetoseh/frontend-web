import { ReactElement, useState } from 'react';
import { LoginButton } from '../shared/LoginButton';
import { LoginProvider } from '../shared/LoginContext';
import { MyProfilePicture } from '../shared/MyProfilePicture';
import { AdminViewContentFile } from './AdminViewContentFile';
import { AdminViewImageFile } from './AdminViewImageFile';
import { JourneyAudioContentUpload } from './JourneyAudioContentUpload';
import { JourneyBackgroundImageUpload } from './JourneyBackgroundImageUpload';
import '../assets/fonts.css';
import { AdminIsProSubscriber } from './AdminIsProSubscriber';
import { AdminNavDesktopTop } from './nav/desktop/top/AdminNavDesktopTop';
import { AdminNavDesktopSideHeader } from './nav/desktop/side/AdminNavDesktopSideHeader';
import { AdminNavDesktopSideContent } from './nav/desktop/side/AdminNavDesktopSideContent';

export default function AdminApp(): ReactElement {
  const [expanded, setExpanded] = useState(true);

  return (
    <LoginProvider>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <AdminNavDesktopSideHeader expanded={expanded} setExpanded={setExpanded} />
        <AdminNavDesktopTop />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <AdminNavDesktopSideContent expanded={expanded} />
        <div style={{ padding: '24px', fontFamily: 'Open Sans', fontSize: '16px', flexGrow: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25em' }}>
            <MyProfilePicture /> AdminApp! <AdminIsProSubscriber />
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
      </div>
    </LoginProvider>
  );
}
