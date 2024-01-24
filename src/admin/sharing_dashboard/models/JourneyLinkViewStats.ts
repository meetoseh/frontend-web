export type JourneyLinkViewStats = {
  labels: string[];
  created: number[];
  created_breakdown: Record<string, number[]>;
  reused: number[];
  reused_breakdown: Record<string, number[]>;
  view_hydration_requests: number[];
  view_hydrated: number[];
  view_hydrated_breakdown: Record<string, number[]>;
  view_hydration_rejected: number[];
  view_hydration_failed: number[];
  view_hydration_failed_breakdown: Record<string, number[]>;
  view_client_confirmation_requests: number[];
  view_client_confirmation_requests_breakdown: Record<string, number[]>;
  view_client_confirmed: number[];
  view_client_confirmed_breakdown: Record<string, number[]>;
  view_client_confirm_failed: number[];
  view_client_confirm_failed_breakdown: Record<string, number[]>;
  view_client_follow_requests: number[];
  view_client_follow_requests_breakdown: Record<string, number[]>;
  view_client_followed: number[];
  view_client_followed_breakdown: Record<string, number[]>;
};

export type PartialJourneyLinkViewStatsItem = {
  created: number;
  created_breakdown: Record<string, number>;
  reused: number;
  reused_breakdown: Record<string, number>;
  view_hydration_requests: number;
  view_hydrated: number;
  view_hydrated_breakdown: Record<string, number>;
  view_hydration_rejected: number;
  view_hydration_failed: number;
  view_hydration_failed_breakdown: Record<string, number>;
  view_client_confirmation_requests: number;
  view_client_confirmation_requests_breakdown: Record<string, number>;
  view_client_confirmed: number;
  view_client_confirmed_breakdown: Record<string, number>;
  view_client_confirm_failed: number;
  view_client_confirm_failed_breakdown: Record<string, number>;
  view_client_follow_requests: number;
  view_client_follow_requests_breakdown: Record<string, number>;
  view_client_followed: number;
  view_client_followed_breakdown: Record<string, number>;
  view_client_follow_failed: number;
  view_client_follow_failed_breakdown: Record<string, number>;
};

export type PartialJourneyLinkViewStats = {
  today: PartialJourneyLinkViewStatsItem;
  yesterday: PartialJourneyLinkViewStatsItem;
};

export type JourneyLinkViewStatsComplete = {
  historical: JourneyLinkViewStats;
  partial: PartialJourneyLinkViewStats;
};
