import { ReactElement } from 'react';
import { FeatureComponentProps } from '../../../models/Feature';
import { ConfirmMergeAccountResources } from '../ConfirmMergeAccountResources';
import { ConfirmMergeAccountState } from '../ConfirmMergeAccountState';
import { TrivialMerge } from './TrivialMerge';

export const ConfirmFinish = ({
  resources,
  state,
}: FeatureComponentProps<ConfirmMergeAccountState, ConfirmMergeAccountResources>): ReactElement => {
  return <TrivialMerge state={state} resources={resources} />;
};
