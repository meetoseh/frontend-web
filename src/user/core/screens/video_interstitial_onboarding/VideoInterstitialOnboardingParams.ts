import { VideoInterstitialAPIParams } from '../video_interstitial/VideoInterstitialParams';

export type VideoInterstitialOnboardingAPIParams = Omit<VideoInterstitialAPIParams, 'video'>;
export type VideoInterstitialOnboardingMappedParams = VideoInterstitialOnboardingAPIParams & {
  __mapped: true;
};
