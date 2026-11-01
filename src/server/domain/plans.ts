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

/** Default plan catalogue (inserted by migration 002 and the seed; editable by the platform admin). */
export const DEFAULT_PLANS = [
  {
    "id": "basic",
    "name": "Basic",
    "description": "A digital stamp card with rewards and referrals.",
    "monthly_price_minor": 900,
    "is_recommended": false,
    "sort_order": 1,
    "feature_configuration": {
      "features": {
        "stamps": true,
        "referrals": true,
        "csvExport": true
      },
      "limits": {
        "locations": 1,
        "programmes": 1,
        "staffSeats": 3,
        "activeCampaigns": 0
      },
      "inheritsFrom": null,
      "highlights": [
        "Digital stamp card",
        "Rewards customers collect on their phone",
        "QR code to join, no app needed",
        "Bring-a-friend referral rewards",
        "Your own logo, colours and banner",
        "Customer list and visit reports",
        "Up to 3 staff accounts"
      ],
      "highlightsTr": [
        "Dijital damga kartı",
        "Müşterilerin telefonda topladığı ödüller",
        "Katılım için QR kod, uygulama gerekmez",
        "Arkadaşını getir ödülleri",
        "Kendi logonuz, renkleriniz ve kapak görseliniz",
        "Müşteri listesi ve ziyaret raporları",
        "3 personel hesabına kadar"
      ]
    }
  },
  {
    "id": "premium",
    "name": "Premium",
    "description": "Points, campaigns and insights to bring regulars back more often.",
    "monthly_price_minor": 1900,
    "is_recommended": true,
    "sort_order": 2,
    "feature_configuration": {
      "features": {
        "stamps": true,
        "points": true,
        "challenges": true,
        "offers": true,
        "campaigns": true,
        "referrals": true,
        "segments": true,
        "inactiveReport": true,
        "advancedInsights": true,
        "flexibleCampaignRules": true,
        "automatedWinback": true,
        "advancedReports": true,
        "csvExport": true,
        "prioritySupport": true
      },
      "limits": {
        "locations": 1,
        "programmes": 4,
        "staffSeats": 15,
        "activeCampaigns": 20
      },
      "inheritsFrom": "Basic",
      "highlights": [
        "Points programme as well as stamps",
        "Campaigns and offers with your own names",
        "Happy-hour and day-of-week offers",
        "Visit challenges",
        "Customer groups and win-back offers",
        "Full analytics",
        "Up to 15 staff accounts",
        "Priority support"
      ],
      "highlightsTr": [
        "Damganın yanında puan programı",
        "Kendi adlarınızla kampanyalar ve teklifler",
        "Saat ve gün bazlı teklifler",
        "Ziyaret görevleri",
        "Müşteri grupları ve geri kazanma teklifleri",
        "Tam analizler",
        "15 personel hesabına kadar",
        "Öncelikli destek"
      ]
    }
  }
];
