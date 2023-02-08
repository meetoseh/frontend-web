import { ReactElement, useMemo, useState } from 'react';
import { Crud } from '../../crud/Crud';
import { CreateIntroductoryJourney } from './CreateIntroductoryJourney';
import { IntroductoryJourney } from './IntroductoryJourney';

/**
 * Shows the crud components for introductory journeys, i.e, journeys that a
 * user would see during their onboarding flow. These are generally fairly
 * generic journeys to ensure the user gets a good first experience before
 * getting thrown into the current daily event.
 */
export const IntroductoryJourneys = (): ReactElement => {
  const [journeys, setJourneys] = useState<IntroductoryJourney[]>([]);

  const createComponent = useMemo(() => {
    return (
      <CreateIntroductoryJourney
        onCreated={(newJourney) => {
          setJourneys((oldJourneys) => [...oldJourneys, newJourney]);
        }}
      />
    );
  }, []);

  return (
    <Crud title="Introductory Journeys" listing={<></>} create={createComponent} filters={<></>} />
  );
};
