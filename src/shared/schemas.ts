/** Configuration schemas shared by the server (validation) and the UI (forms). */
import { z } from 'zod';

export const CURRENCIES = ['EUR', 'TRY'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const stampConfigSchema = z.object({
  stampsRequired: z.number().int().min(2).max(30),
  eligiblePurchase: z.string().trim().min(2).max(120),
  maxStampsPerTransaction: z.number().int().min(1).max(10).default(1),
  allowWithOtherPromotions: z.boolean().default(false),
});
export type StampConfig = z.infer<typeof stampConfigSchema>;

export const pointsConfigSchema = z
  .object({
    earnMode: z.enum(['per_currency_unit', 'per_purchase']),
    pointsPerUnit: z.number().int().min(1).max(100).default(1),
    pointsPerPurchase: z.number().int().min(1).max(1000).default(10),
    minSpendMinor: z.number().int().min(0).max(10_000_000).default(0),
    maxPointsPerTransaction: z.number().int().min(1).max(100_000).default(500),
    eligiblePurchase: z.string().trim().min(2).max(120),
    allowWithOtherPromotions: z.boolean().default(false),
  });
export type PointsConfig = z.infer<typeof pointsConfigSchema>;

export const SEGMENTS = ['all', 'new', 'active', 'frequent', 'approaching', 'unused_rewards', 'inactive', 'no_visits'] as const;
export type SegmentKey = (typeof SEGMENTS)[number];

export const businessSettingsSchema = z.object({
  inactivityDays: z.number().int().min(7).max(365).default(21),
  newMemberDays: z.number().int().min(7).max(120).default(30),
  frequentVisits: z.number().int().min(2).max(60).default(4),
  approachingStamps: z.number().int().min(1).max(10).default(2),
  visitWindowMinutes: z.number().int().min(15).max(720).default(120),
  duplicateGuardSeconds: z.number().int().min(0).max(3600).default(60),
  refundPolicy: z.enum(['reverse', 'keep']).default('reverse'),
  staffInstructions: z.string().max(1000).default(''),
  operationalAlerts: z.boolean().default(true),
  showOffersPublicly: z.boolean().default(true),
  /** Look of the café's customer pages. */
  pageLayout: z.enum(['classic', 'banner', 'minimal']).default('classic'),
  stampIcon: z.enum(['bean', 'cup', 'star', 'heart', 'leaf', 'check']).default('bean'),
  tagline: z.string().max(140).default(''),
});
export const PAGE_LAYOUTS = ['classic', 'banner', 'minimal'] as const;
export const STAMP_ICONS = ['bean', 'cup', 'star', 'heart', 'leaf', 'check'] as const;
export type StampIcon = (typeof STAMP_ICONS)[number];
export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

export function parseSettings(raw: unknown): BusinessSettings {
  const r = businessSettingsSchema.safeParse(raw ?? {});
  return r.success ? r.data : businessSettingsSchema.parse({});
}

/** What a member receives from a campaign, challenge or referral. */
export const grantSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('voucher'), rewardId: z.string().uuid() }),
  z.object({ kind: z.literal('bonus'), programmeId: z.string().uuid(), amount: z.number().int().min(1).max(10000) }),
]);
export type Grant = z.infer<typeof grantSchema>;

export const campaignBenefitSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('voucher'), rewardId: z.string().uuid() }),
  z.object({
    kind: z.literal('bonus'),
    programmeId: z.string().uuid(),
    mode: z.enum(['flat', 'multiplier']).default('flat'),
    amount: z.number().int().min(1).max(10000),
  }),
]);
export type CampaignBenefit = z.infer<typeof campaignBenefitSchema>;

export const campaignEligibilitySchema = z.object({
  weekdays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
});
export type CampaignEligibility = z.infer<typeof campaignEligibilitySchema>;

export const optionalGrantSchema = z.union([grantSchema, z.object({ kind: z.literal('none') })]);
export const referralConfigSchema = z.object({
  referrerGrant: grantSchema,
  referredGrant: optionalGrantSchema,
  maxPerReferrer: z.number().int().min(1).max(100).default(10),
  /** When the inviter is rewarded: at the friend's first verified visit (default) or as soon as the friend joins. */
  qualifyOn: z.enum(['first_visit', 'join']).default('first_visit'),
});
export type ReferralConfig = z.infer<typeof referralConfigSchema>;

export const CAMPAIGN_TYPES = ['welcome', 'bonus_points', 'limited_time', 'weekday', 'birthday', 'referral', 'win_back', 'custom'] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const REWARD_TYPES = ['free_item', 'discount', 'free_upgrade', 'custom'] as const;
export const REWARD_ICONS = ['coffee', 'cup', 'croissant', 'cake', 'gift', 'percent', 'sparkles', 'star', 'heart'] as const;

export const planFeaturesSchema = z.object({
  features: z
    .object({
      stamps: z.boolean().default(true),
      points: z.boolean().default(false),
      challenges: z.boolean().default(false),
      offers: z.boolean().default(false),
      campaigns: z.boolean().default(false),
      referrals: z.boolean().default(false),
      segments: z.boolean().default(false),
      inactiveReport: z.boolean().default(false),
      advancedInsights: z.boolean().default(false),
      flexibleCampaignRules: z.boolean().default(false),
      automatedWinback: z.boolean().default(false),
      advancedReports: z.boolean().default(false),
      csvExport: z.boolean().default(true),
      prioritySupport: z.boolean().default(false),
    })
    .default({}),
  limits: z
    .object({
      locations: z.number().int().min(1).default(1),
      programmes: z.number().int().min(1).default(1),
      staffSeats: z.number().int().min(1).default(3),
      activeCampaigns: z.number().int().min(0).default(0),
    })
    .default({}),
  highlights: z.array(z.string()).default([]),
  inheritsFrom: z.string().nullable().default(null),
});
export type PlanFeatures = z.infer<typeof planFeaturesSchema>;
export type FeatureKey = keyof PlanFeatures['features'];
