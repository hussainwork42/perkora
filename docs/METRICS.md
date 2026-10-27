# Metric and segment definitions

Every number in the owner dashboard comes from the café's own Perkora records. Nothing is estimated, modelled or borrowed from other cafés. The same definitions appear next to each metric in the app (the ⓘ icons). They are defined in `src/server/domain/analytics.ts` and `src/server/domain/segments.ts`.

## Ground rules

- **Café-local time.** Days, weeks and months use the café's timezone (Girne cafés: `Asia/Famagusta`), not UTC. A visit at 00:30 local time counts on the local date.
- **Verified visits.** A *verified visit* is a stamp or points award recorded by staff at the terminal (or the counter flow). Several awards to one member within the café's *visit window* (default 120 minutes, set under Café Settings → Loyalty) count as **one** visit.
- **Corrections.** Reversals are subtracted. A reversed award or redemption no longer counts.
- **Members only.** Perkora sees loyalty members, not every customer who walks in. It does not report revenue or "uplift", because it cannot see sales that did not go through the terminal.
- **Small numbers.** Rates are hidden when the sample is too small to mean anything (see below).

## Metrics

| Metric | Definition |
|---|---|
| **Total members** | Active loyalty memberships at this café today. Closed memberships are excluded. |
| **Active members** | Members with at least one verified visit in the last *N* days, where *N* is the café's inactivity threshold (default 21). |
| **Visits** | Verified visits in the period. Awards to the same member within the visit window count as one visit. |
| **Unique visitors** | Distinct members with at least one verified visit in the period. |
| **New members** | Members who joined in the period. |
| **Returning-member rate** | Of the members who visited in the period, the share with at least two verified visits in total up to the end of the period. Shown only when **at least 5** members visited. It describes loyalty members only, not all café customers. |
| **Stamps issued** | Stamps given in the period (purchases, bonuses, challenges, referrals and adjustments), net of reversals. |
| **Points issued** | Points given in the period, net of reversals. |
| **Rewards issued** | Rewards unlocked or granted in the period: filled stamp cards, campaign, challenge and referral rewards, and points rewards claimed. |
| **Rewards redeemed** | Rewards redeemed at the counter in the period, excluding reversed redemptions. |
| **Redemption rate** | Of the rewards issued in the period, the share already redeemed. Shown only when at least one reward was issued. |

**Campaign performance** counts what a campaign itself issued (bonus stamps or points, and rewards) and how many of those rewards were redeemed. It does not claim the campaign *caused* visits.

## Customer segments

Segments are live filters. A member can be in several at once. The thresholds come from Café Settings → Loyalty.

| Segment | Definition (defaults in brackets) |
|---|---|
| **All members** | Every active loyalty member. |
| **New members** | Joined in the last *N* days [30]. |
| **Active** | Made a verified visit in the last *N* days [21, the inactivity threshold]. |
| **Frequent visitors** | *N* or more verified visits in the last 30 days [4]. |
| **Close to a reward** | *N* or fewer stamps to go on a stamp card [2], or within 20% of the cost of a points reward. |
| **Unused rewards** | Holds at least one reward that has not been redeemed or expired. |
| **Not visited recently** | Has visited before, but has no verified visit in the last *N* days [21]. |
| **Joined, no visit yet** | Joined the programme but has no verified visit yet. |

Campaigns can target a segment. A segment-targeted offer is shown only to members in that segment at the time they look. Win-back distribution ("We miss you") issues each eligible member at most one reward per campaign.
