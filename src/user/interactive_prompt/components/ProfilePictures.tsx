import { useEffect, useRef } from 'react';
import { Callbacks } from '../../../shared/lib/Callbacks';
import { kFormatter } from '../../../shared/lib/kFormatter';
import {
  ProfilePicturesStateChangedEvent,
  ProfilePicturesStateRef,
} from '../hooks/useProfilePictures';
import styles from './ProfilePictures.module.css';
import { combineClasses } from '../../../shared/lib/combineClasses';
import { OsehImageState } from '../../../shared/images/OsehImageState';

const FADE_TIME = 350;

type HereSettings =
  | {
      type: 'filled';
      action: string;
    }
  | {
      type: 'floating';
      action: string;
    };

/**
 * Displays profile pictures from the given state ref.
 */
export const ProfilePictures = ({
  profilePictures,
  hereSettings,
}: {
  profilePictures: ProfilePicturesStateRef;
  hereSettings?: HereSettings;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bonusRef = useRef<HTMLDivElement>(null);
  const bonusAmountRef = useRef<HTMLDivElement>(null);
  const trueHereSettings =
    hereSettings === undefined ? { type: 'filled', action: 'here' } : hereSettings;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let active = true;
    const spots: Spot[] = [];

    profilePictures.onStateChanged.current.add(handleEvent);
    updatePictures();
    return () => {
      active = false;
      profilePictures.onStateChanged.current.remove(handleEvent);
      container.textContent = '';
    };

    function handleEvent(event: ProfilePicturesStateChangedEvent) {
      updatePictures();
    }

    function updatePictures() {
      const state = profilePictures.state.current;
      for (let i = 0; i < spots.length && i < state.pictures.length; i++) {
        const pic = state.pictures[i];
        if (spots[i].img?.localUrl === pic.localUrl || pic.localUrl === null) {
          continue;
        }
        spots[i].changed.call(undefined);

        if (spots[i].img === null) {
          spots[i].bottom.src = pic.localUrl;
          spots[i].bottom.style.opacity = '100%';
          continue;
        }

        fadeOutBottom(i);
        swapOutBottom(i, pic);
      }

      for (let i = spots.length; i < state.pictures.length; i++) {
        addSpot(state.pictures[i]);
      }

      for (let i = spots.length - 1; i >= state.pictures.length; i--) {
        removeSpotAfterFadeOut(i);
      }
    }

    async function fadeOutBottom(i: number) {
      const container = document.createElement('div');
      container.classList.add(styles.fadingOutItemWrapper);

      const image = document.createElement('img');
      image.classList.add(styles.fadingOutItem);
      image.src = spots[i].bottom.src;

      container.appendChild(image);

      spots[i].fadingOutContainer.insertAdjacentElement('afterbegin', container);
      spots[i].fadingOutCount++;

      image.style.transition = 'unset';
      image.style.opacity = '100%';
      image.getClientRects();
      image.style.removeProperty('transition');
      image.getClientRects();
      image.style.opacity = '0%';
      await new Promise((resolve) => setTimeout(resolve, FADE_TIME));
      if (!active) {
        return;
      }

      spots[i].fadingOutCount--;
      container.remove();
    }

    function addSpot(pic: OsehImageState) {
      if (pic.localUrl === null) {
        return;
      }
      const callbacks = new Callbacks<undefined>();

      const itemContainer = document.createElement('div');
      itemContainer.classList.add(styles.itemContainer);

      const fadeOutContainer = document.createElement('div');
      fadeOutContainer.classList.add(styles.fadingOutContainer);
      itemContainer.appendChild(fadeOutContainer);

      const bottom = document.createElement('img');
      bottom.classList.add(styles.item);
      bottom.src = pic.localUrl;
      bottom.style.transition = 'unset';
      bottom.style.opacity = '0%';
      itemContainer.appendChild(bottom);

      container?.insertAdjacentElement('beforeend', itemContainer);
      bottom.getClientRects();
      bottom.style.removeProperty('transition');
      bottom.getClientRects();
      bottom.style.opacity = '100%';

      spots.push({
        outerContainer: itemContainer,
        bottom,
        img: pic,
        fadingOutContainer: fadeOutContainer,
        fadingOutCount: 0,
        changed: callbacks,
      });
    }

    async function removeSpotAfterFadeOut(i: number) {
      const spot = spots[i];
      spot.img = null;
      spot.bottom.style.opacity = '0%';

      let canceled = false;
      const onChanged = () => {
        canceled = true;
        spot.changed.remove(onChanged);
      };
      spot.changed.add(onChanged);

      await new Promise((resolve) => setTimeout(resolve, FADE_TIME));

      if (!active || canceled) {
        return;
      }

      spot.changed.remove(onChanged);
      spot.outerContainer.remove();

      const newIndex = spots.indexOf(spot);
      if (newIndex >= 0) {
        spots.splice(newIndex, 1);
      }
    }

    async function swapOutBottom(i: number, pic: OsehImageState) {
      spots[i].img = pic;
      spots[i].bottom.src = pic.localUrl!;
      spots[i].bottom.style.transition = 'unset';
      spots[i].bottom.style.opacity = '0%';
      spots[i].bottom.getClientRects();

      spots[i].bottom.style.removeProperty('transition');
      spots[i].bottom.getClientRects();
      spots[i].bottom.style.opacity = '100%';
    }
  }, [profilePictures]);

  useEffect(() => {
    const bonus = bonusRef.current as HTMLDivElement;
    const bonusAmount = bonusAmountRef.current as HTMLDivElement;
    if (bonus === null || bonusAmount === null) {
      return;
    }

    let lastAmount: number | null = null;
    profilePictures.onStateChanged.current.add(handleEvent);
    updateBonus();
    return () => {
      bonusAmount.textContent = '';
    };

    function handleEvent(event: ProfilePicturesStateChangedEvent) {
      updateBonus();
    }

    function updateBonus() {
      const state = profilePictures.state.current;
      const approxAmount = Math.ceil(state.additionalUsers);
      if (approxAmount === lastAmount) {
        return;
      }
      lastAmount = approxAmount;
      if (state.additionalUsers <= 0) {
        bonusAmount.textContent = '+0';
        bonus.style.opacity = '0%';
      } else {
        bonusAmount.textContent = `+${kFormatter(approxAmount)}`;
        bonus.style.opacity = '100%';
      }
    }
  }, [profilePictures]);

  return (
    <div className={styles.outerContainer}>
      <div ref={containerRef} className={styles.container} />
      <div
        ref={bonusRef}
        className={combineClasses(
          styles.bonusContainer,
          styles['hereVariant-' + trueHereSettings.type]
        )}>
        <div ref={bonusAmountRef} />
        <div>{trueHereSettings.action}</div>
      </div>
    </div>
  );
};

type Spot = {
  img: OsehImageState | null;
  outerContainer: HTMLDivElement;
  bottom: HTMLImageElement;
  fadingOutContainer: HTMLDivElement;
  fadingOutCount: number;
  changed: Callbacks<undefined>;
};
