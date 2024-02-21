import { MutableRefObject, ReactElement, useEffect, useRef } from 'react';
import { useOsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import {
  Callbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { OsehImageState, areOsehImageStatesEqual } from '../../../shared/images/OsehImageState';
import { setVWC } from '../../../shared/lib/setVWC';
import { ImageFilesChoice } from '../../../shared/upload/selector/ImageFilesChoice';
import { ImageFileChoice } from '../../../shared/upload/selector/ImageFileChoice';
import { DisplaySize } from '../../images/OsehImageProps';
import { OsehImageRef } from '../../images/OsehImageRef';

/**
 * Presents a list of images at the given resolution, allowing the user to
 * select one.
 */
export const SimpleImageFilesChoice = <T extends object>({
  items,
  itemToImage,
  displaySize,
  onClick,
}: {
  items: T[];
  itemToImage: (item: T) => OsehImageRef;
  displaySize: DisplaySize;
  onClick: (item: T) => void;
}): ReactElement => {
  const imageHandler = useOsehImageStateRequestHandler({});

  const images = useRef<WritableValueWithCallbacks<OsehImageState>[]>() as MutableRefObject<
    WritableValueWithCallbacks<OsehImageState>[]
  >;
  if (images.current === undefined || images.current.length !== items.length) {
    images.current = items.map(() =>
      createWritableValueWithCallbacks<OsehImageState>({
        localUrl: null,
        thumbhash: null,
        displayWidth: displaySize.displayWidth ?? displaySize.displayHeight,
        displayHeight: displaySize.displayHeight ?? displaySize.displayWidth,
        alt: '',
        loading: true,
      })
    );
  }

  useEffect(() => {
    const requests = items.map((item) => {
      const mapped = itemToImage(item);
      return imageHandler.request({
        uid: mapped.uid,
        jwt: mapped.jwt,
        ...displaySize,
        alt: '',
      });
    });

    let running = true;
    const cancelers = new Callbacks<undefined>();

    requests.forEach((request, index) => {
      const vwc = images.current[index];
      if (vwc === undefined) {
        request.release();
        return;
      }

      request.stateChanged.add(onStateChange);
      cancelers.add(() => {
        request.stateChanged.remove(onStateChange);
        request.release();
      });

      function onStateChange() {
        if (!running) {
          return;
        }

        setVWC(vwc, request.state, areOsehImageStatesEqual);
      }
    });

    return () => {
      running = false;
      cancelers.call(undefined);
    };
  }, [items, imageHandler]);

  return (
    <ImageFilesChoice>
      {items.map((item, index) => (
        <ImageFileChoice
          key={itemToImage(item).uid}
          image={images.current[index]}
          onClick={() => onClick(item)}
        />
      ))}
    </ImageFilesChoice>
  );
};
