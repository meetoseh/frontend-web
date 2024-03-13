import { ReactElement } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { GotoEmotionResources } from './GotoEmotionResources';
import { GotoEmotionState } from './GotoEmotionState';
import styles from './GotoEmotion.module.css';
import { IconButton } from '../../../../shared/forms/IconButton';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { ProfilePictures } from '../../../interactive_prompt/components/ProfilePictures';
import { FullHeightDiv } from '../../../../shared/components/FullHeightDiv';
import { Button } from '../../../../shared/forms/Button';

/**
 * Allows the user to start a class within a given emotion, or go back to
 * their home screen.
 */
export const GotoEmotion = ({
  state,
  resources,
}: FeatureComponentProps<GotoEmotionState, GotoEmotionResources>): ReactElement => {
  return (
    <div className={styles.container}>
      <FullHeightDiv className={styles.background} />
      <div className={styles.foreground}>
        <div className={styles.backButton}>
          <IconButton
            icon={styles.iconBack}
            srOnlyName="Back"
            onClick={(e) => {
              e.preventDefault();
              resources.get().onBack();
            }}
          />
        </div>
        <div className={styles.content}>
          <div className={styles.title}>You want to feel</div>
          <RenderGuardedComponent
            props={useMappedValueWithCallbacks(state, (s) => s.show?.emotion?.word ?? '')}
            component={(word) => <div className={styles.emotion}>{word}</div>}
          />
          <div className={styles.socialProof}>
            <RenderGuardedComponent
              props={useMappedValueWithCallbacks(
                resources,
                (r) => r.freeEmotionJourney.result?.numVotes ?? 0
              )}
              component={(votes) => (
                <div className={styles.socialProofMessage}>
                  {votes.toLocaleString()} others also chose this today
                </div>
              )}
            />
            <div className={styles.socialProofPictures}>
              <ProfilePictures
                profilePictures={useMappedValueWithCallbacks(resources, (r) => ({
                  pictures: r.socialProofPictures,
                  additionalUsers: 0,
                }))}
                hereSettings={{ type: 'none' }}
                center
                size="24px"
              />
            </div>
          </div>
        </div>
        <div className={styles.buttons}>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              resources.get().onTakeFreeJourney();
            }}
            variant="filled-white"
            fullWidth>
            Take a 1-minute Class
          </Button>
          <RenderGuardedComponent
            props={useMappedValueWithCallbacks(
              resources,
              (r) =>
                r.havePro.type === 'loading' ||
                (r.havePro.type === 'success' && !r.havePro.result) ||
                (r.premiumEmotionJourney.type !== 'unavailable' &&
                  r.premiumEmotionJourney.type !== 'load-prevented')
            )}
            component={(show) =>
              !show ? (
                <></>
              ) : (
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    resources.get().onTakePremiumJourney();
                  }}
                  variant="filled-premium"
                  fullWidth>
                  Take a Longer Class
                </Button>
              )
            }
          />
        </div>
      </div>
    </div>
  );
};
