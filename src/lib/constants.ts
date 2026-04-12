export const PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    maxInfluencers: 1,
    credits: 50,
    hasVideo: false,
    hasNsfw: false,
    hasAutoPublish: false,
    hasAdvancedAnalytics: false,
  },
  PRO: {
    name: "Pro",
    price: 29,
    maxInfluencers: 5,
    credits: 500,
    hasVideo: true,
    hasNsfw: true,
    hasAutoPublish: true,
    hasAdvancedAnalytics: false,
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: 99,
    maxInfluencers: Infinity,
    credits: Infinity,
    hasVideo: true,
    hasNsfw: true,
    hasAutoPublish: true,
    hasAdvancedAnalytics: true,
  },
} as const;

export const CREDIT_COSTS = {
  PHOTO: 1,
  REEL: 5,
  CAPTION: 0.5,
  BASE_IMAGE: 2,
  HASHTAGS: 0.25,
} as const;

