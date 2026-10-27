import type { Queryable } from '../db';
import { many } from '../db';
import { planFeaturesSchema, type PlanFeatures } from '../../shared/schemas';

export interface PlanView {
  id: string;
  name: string;
  description: string;
  monthlyPriceMinor: number;
  currency: string;
  recommended: boolean;
  status: string;
  features: PlanFeatures;
  highlights: string[];
  highlightsTr: string[];
  inheritsFrom: string | null;
}

export async function loadPlans(q: Queryable, includeHidden = false): Promise<PlanView[]> {
  const rows = await many<any>(
    q,
    `select * from plans ${includeHidden ? '' : `where status = 'active'`} order by sort_order, monthly_price_minor`,
  );
  return rows.map((r) => {
    const f = planFeaturesSchema.parse(r.feature_configuration ?? {});
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      monthlyPriceMinor: r.monthly_price_minor,
      currency: r.currency,
      recommended: r.is_recommended,
      status: r.status,
      features: f,
      highlights: f.highlights,
      highlightsTr: Array.isArray(r.feature_configuration?.highlightsTr) ? r.feature_configuration.highlightsTr : f.highlights,
      inheritsFrom: f.inheritsFrom,
    };
  });
}

/** Default plan catalogue (inserted by the seed; editable by the platform admin). */
export const DEFAULT_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'A digital stamp card for one café.',
    monthly_price_minor: 900,
    is_recommended: false,
    sort_order: 1,
    feature_configuration: {
      features: { stamps: true, csvExport: true },
      limits: { locations: 1, programmes: 1, staffSeats: 2, activeCampaigns: 0 },
      inheritsFrom: null,
      highlights: [
        'One café location',
        'One digital loyalty programme',
        'Digital stamp card',
        'Basic rewards',
        'QR-code enrolment',
        'Basic customer list',
        'Basic visit and redemption reporting',
      ],
      highlightsTr: [
        'Bir kafe şubesi',
        'Bir dijital sadakat programı',
        'Dijital damga kartı',
        'Temel ödüller',
        'QR kod ile katılım',
        'Temel müşteri listesi',
        'Temel ziyaret ve ödül kullanım raporları',
      ],
    },
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'Points, streaks and offers to bring regulars back.',
    monthly_price_minor: 1900,
    is_recommended: true,
    sort_order: 2,
    feature_configuration: {
      features: { stamps: true, points: true, challenges: true, offers: true, campaigns: true, referrals: true, segments: true, inactiveReport: true, csvExport: true },
      limits: { locations: 1, programmes: 2, staffSeats: 5, activeCampaigns: 5 },
      inheritsFrom: 'Starter',
      highlights: [
        'Points-based loyalty',
        'Configurable visit streaks',
        'Promotional offers',
        'Referral functionality',
        'Customer segmentation',
        'Inactive-customer reporting',
        'Campaign management',
        'Improved analytics',
      ],
      highlightsTr: [
        'Puan tabanlı sadakat',
        'Ayarlanabilir ziyaret serileri',
        'Promosyon teklifleri',
        'Arkadaş getirme özelliği',
        'Müşteri segmentasyonu',
        'Gelmeyen müşteri raporları',
        'Kampanya yönetimi',
        'Gelişmiş analizler',
      ],
    },
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Deeper insights and more flexible campaigns.',
    monthly_price_minor: 3500,
    is_recommended: false,
    sort_order: 3,
    feature_configuration: {
      features: {
        stamps: true,
        points: true,
        challenges: true,
        offers: true,
        campaigns: true,
        referrals: true,
        segments: true,
        inactiveReport: true,
        advancedInsights: true,
        flexibleCampaignRules: true,
        automatedWinback: true,
        advancedReports: true,
        csvExport: true,
        prioritySupport: true,
      },
      limits: { locations: 1, programmes: 4, staffSeats: 15, activeCampaigns: 20 },
      inheritsFrom: 'Growth',
      highlights: [
        'Advanced customer insights',
        'More flexible campaign rules',
        'Automated win-back campaigns, when the required messaging service is configured',
        'Advanced reports',
        'Additional staff management capabilities',
        'Priority support',
      ],
      highlightsTr: [
        'Gelişmiş müşteri içgörüleri',
        'Daha esnek kampanya kuralları',
        'Gerekli mesajlaşma hizmeti yapılandırıldığında otomatik geri kazanma kampanyaları',
        'Gelişmiş raporlar',
        'Ek personel yönetimi olanakları',
        'Öncelikli destek',
      ],
    },
  },
];
