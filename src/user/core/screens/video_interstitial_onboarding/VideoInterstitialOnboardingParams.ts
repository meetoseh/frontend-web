import {
  VideoInterstitialAPIParams,
  VideoInterstitialMappedParams,
} from '../video_interstitial/VideoInterstitialParams';

export type VideoInterstitialOnboardingAPIParams = Omit<VideoInterstitialAPIParams, 'video'>;
export type VideoInterstitialOnboardingMappedParams = Omit<VideoInterstitialMappedParams, 'video'>;
