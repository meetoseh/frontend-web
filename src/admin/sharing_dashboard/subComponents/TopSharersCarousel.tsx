import { ReactElement, useCallback } from 'react';
import { TopSharerCarouselItem } from '../models/TopSharers';
import styles from './TopSharersCarousel.module.css';
import assistiveStyles from '../../../shared/assistive.module.css';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { setVWC } from '../../../shared/lib/setVWC';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { useNetworkResponse } from '../../../shared/hooks/useNetworkResponse';
import { User, userKeyMap } from '../../users/User';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { InlineOsehSpinner } from '../../../shared/components/InlineOsehSpinner';
import { useOsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageStateValueWithCallbacks } from '../../../shared/images/useOsehImageStateValueWithCallbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { combineClasses } from '../../../shared/lib/combineClasses';
import { apiFetch } from '../../../shared/ApiConstants';
import { convertUsingKeymap } from '../../crud/CrudFetcher';

export const TopSharersCarousel = ({ items }: { items: TopSharerCarouselItem[] }): ReactElement => {
  const selected = useWritableValueWithCallbacks(() => 0);
  const autoplayCooldown = useWritableValueWithCallbacks(() => false);

  useValueWithCallbacksEffect(autoplayCooldown, (value) => {
    if (!value) {
      return undefined;
    }

    let timeout: NodeJS.Timeout | null = setTimeout(cooldownFinished, 60000);
    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    function cooldownFinished() {
      timeout = null;
      setVWC(autoplayCooldown, false);
    }
  });

  useValueWithCallbacksEffect(autoplayCooldown, (onCooldown) => {
    if (onCooldown) {
      return undefined;
    }

    let timeout: NodeJS.Timeout | null = setTimeout(advance, 5000);
    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    function advance() {
      setVWC(selected, (selected.get() + 1) % items.length);
      timeout = setTimeout(advance, 5000);
    }
  });

  const jumpToItem = useCallback(
    (index: number) => {
      setVWC(selected, index);
      setVWC(autoplayCooldown, true);
    },
    [selected, autoplayCooldown]
  );

  return (
    <div className={styles.container}>
      <div className={styles.itemsContainer}>
        {items.map((item, index) => (
          <CarouselItem key={index} item={item} index={index} selected={selected} />
        ))}
      </div>
      <div className={styles.dots}>
        {items.map((_item, index) => {
          return (
            <button
              key={index}
              className={styles.dotButton}
              onClick={(e) => {
                e.preventDefault();
                jumpToItem(index);
              }}>
              <RenderGuardedComponent
                props={selected}
                component={(sel) => (
                  <div
                    className={combineClasses(
                      styles.dot,
                      sel === index ? styles.dotSelected : undefined
                    )}
                  />
                )}
              />
              <div className={assistiveStyles.srOnly}>Slide {index + 1}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const CarouselItem = ({
  item,
  index,
  selected,
}: {
  item: TopSharerCarouselItem;
  index: number;
  selected: ValueWithCallbacks<number>;
}): ReactElement => {
  const userInfo = useNetworkResponse<User>(
    useCallback(
      async (active, loginContext) => {
        const controller = window.AbortController ? new window.AbortController() : undefined;
        const signal = controller?.signal;
        const doAbort = () => controller?.abort();
        active.callbacks.add(doAbort);
        if (!active.get()) {
          active.callbacks.remove(doAbort);
          return null;
        }

        try {
          const response = await apiFetch(
            '/api/1/users/search',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                filters: {
                  sub: {
                    operator: 'eq',
                    value: item.sharer.sub,
                  },
                },
                limit: 1,
                signal,
              }),
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          const rawData: { items: any[] } = await response.json();
          if (rawData.items.length < 1) {
            throw new Error('No user found');
          }

          if (typeof userKeyMap === 'function') {
            return userKeyMap(rawData.items[0]);
          }

          return convertUsingKeymap(rawData.items[0], userKeyMap);
        } finally {
          active.callbacks.remove(doAbort);
        }
      },
      [item]
    )
  );

  return (
    <RenderGuardedComponent
      props={selected}
      component={(sel) => (
        <div style={sel === index ? undefined : { display: 'none' }} className={styles.itemWrapper}>
          <RenderGuardedComponent props={userInfo.error} component={(err) => err ?? <></>} />
          <RenderGuardedComponent
            props={userInfo.result}
            component={(user) => <CarouselItemContent item={item} user={user} />}
          />
        </div>
      )}
    />
  );
};

const ITEM_LIST_TO_NAME = {
  allTime: 'overall',
  last30Days: 'in the last 30 days',
} as const;

const CarouselItemContent = ({
  item,
  user,
}: {
  item: TopSharerCarouselItem;
  user: User | null;
}): ReactElement => {
  const imageHandler = useOsehImageStateRequestHandler({});
  const profileImage = useOsehImageStateValueWithCallbacks(
    {
      type: 'react-rerender',
      props: {
        uid: user?.profilePicture?.uid ?? null,
        jwt: user?.profilePicture?.jwt ?? null,
        displayWidth: 45,
        displayHeight: 45,
        alt: 'Profile',
      },
    },
    imageHandler
  );

  if (user === null) {
    return (
      <div className={combineClasses(styles.item, styles.itemLoading)}>
        <InlineOsehSpinner
          size={{
            type: 'react-rerender',
            props: {
              width: 64,
            },
          }}
          variant="black"
        />
      </div>
    );
  }

  return (
    <div className={styles.item}>
      <div className={styles.ranking}>
        <div className={styles.rankingNumber}>{(item.position + 1).toLocaleString()}</div>
        <div className={styles.rankingList}>{ITEM_LIST_TO_NAME[item.list]}</div>
      </div>
      <div className={styles.userInfo}>
        <div className={styles.userInfoRow}>
          <div className={styles.userProfilePicture}>
            <OsehImageFromStateValueWithCallbacks state={profileImage} />
          </div>
          <div className={styles.userInfoText}>
            <div className={styles.userName}>
              {user.givenName} {user.familyName}
            </div>
            <div className={styles.userEmails}>
              {user.emails.map((email) => (
                <div key={email.address} className={styles.userEmail}>
                  {email.address}
                  {!email.verified || email.suppressed ? (
                    <div className={styles.userEmailTags}>
                      {email.verified ? null : (
                        <div className={styles.userEmailTag}>unverified</div>
                      )}
                      {email.suppressed ? (
                        <div className={styles.userEmailTag}>suppressed</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.userInfoRow}>
          <div className={styles.userInfoText}>
            <div className={styles.phones}>
              {user.phones.map((phone) => (
                <div key={phone.number} className={styles.phone}>
                  {phone.number}
                  {!phone.verified || phone.suppressed ? (
                    <div className={styles.phoneTags}>
                      {phone.verified ? null : <div className={styles.phoneTag}>unverified</div>}
                      {phone.suppressed ? <div className={styles.phoneTag}>suppressed</div> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className={styles.userSince}>Joined {user.createdAt.toLocaleDateString()}</div>
          </div>
        </div>
      </div>
      <div className={styles.linkStats}>
        <div className={styles.linkStatsRow}>
          <div className={styles.linkStatsTitle}>Links Created</div>
          <div className={styles.linkStatsValue}>{item.sharer.linksCreated.toLocaleString()}</div>
        </div>
        <div className={styles.linkStatsRow}>
          <div className={styles.linkStatsTitle}>Views Total</div>
          <div className={styles.linkStatsValue}>{item.sharer.linkViewsTotal.toLocaleString()}</div>
        </div>
        <div className={styles.linkStatsRow}>
          <div className={styles.linkStatsTitle}>Unique Views</div>
          <div className={styles.linkStatsValue}>
            {item.sharer.linkViewsUnique.toLocaleString()}
          </div>
        </div>
        <div className={styles.linkStatsRow}>
          <div className={styles.linkStatsTitle}>Attributable Users</div>
          <div className={styles.linkStatsValue}>
            {item.sharer.linkAttributableUsers.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};
