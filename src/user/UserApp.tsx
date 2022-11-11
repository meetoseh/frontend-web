import './UserApp.css';
import cover from '../assets/neil-bates--JpaH40RwQ0-unsplash.jpg';
import logo from '../assets/Oseh_Wordmark_White.svg';
import { ReactElement } from 'react';

export default function UserApp(): ReactElement {
  return (
    <div className="UserApp">
      <img className="UserApp-cover" src={cover} alt="cover" />
      <div className="UserApp-content">
        <img className="UserApp-logo" src={logo} alt="logo" />
        COMING SOON
      </div>
    </div>
  );
}
