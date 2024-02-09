import { MutableRefObject, ReactElement, useEffect, useRef } from 'react';
import { JourneyBackgroundImage } from './JourneyBackgroundImage';
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

/**
 * Presents a list of journey background images, allowing the user to
 * select one.
 */
export const JourneyBackgroundImageList = ({
  items,
  onClick,
}: {
  items: JourneyBackgroundImage[];
  onClick: (item: JourneyBackgroundImage) => void;
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
        displayWidth: 180,
        displayHeight: 368,
        alt: '',
        loading: true,
      })
    );
  }

  useEffect(() => {
    const requests = items.map((item) =>
      imageHandler.request({
        uid: item.imageFile.uid,
        jwt: item.imageFile.jwt,
        displayWidth: 180,
        displayHeight: 368,
        alt: '',
      })
    );

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
          key={item.uid}
          image={images.current[index]}
          onClick={() => onClick(item)}
        />
      ))}
    </ImageFilesChoice>
  );
};
