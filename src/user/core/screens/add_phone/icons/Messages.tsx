import AndroidMessages from './AndroidMessages';
import IOSMessages from './IOSMessages';

const Messages = (props: { width?: number; height?: number }) => {
  if (android()) {
    return <AndroidMessages {...props} />;
  }

  return <IOSMessages {...props} />;
};

// https://stackoverflow.com/a/6031480
function android() {
  return (
    window.navigator &&
    window.navigator.userAgent &&
    window.navigator.userAgent.toLowerCase().indexOf('android') > -1
  );
}
export default Messages;
