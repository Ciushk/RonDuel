# RonDuel Analytics & KPIs (PostHog Cloud EU)

- **Host:** `https://eu.i.posthog.com`
- **Privacy mode:** Cookieless / memory persistence until explicit user opt-in (`consent.analytics === true`). Never send email addresses to PostHog; identify solely by `uid`.

## Event Catalogue (`snake_case`)

All events carry `{ locale, is_pwa, platform, league_id?, ref? }`:

- `landing_viewed`, `invite_link_opened`, `nickname_set`
- `round_started`, `item_answered`, `round_finished`
- `share_clicked`, `share_completed`
- `league_created`, `league_joined`
- `duel_created`, `duel_finished`
- `install_prompt_shown`, `app_installed`
- `push_opt_in`, `email_opt_in`, `account_upgraded`
- `paywall_viewed`, `checkout_started`, `subscription_started`, `subscription_cancelled`

## KPI Definitions & PostHog HogQL Queries

### 1. D1 / D7 Retention

Cohort of users whose first `round_finished` occurs on Day 0 (local date), measuring the share who also trigger `round_finished` on Day 1 and Day 7:

```sql
SELECT
  dateDiff('day', first_day, play_day) AS day_offset,
  count(DISTINCT person_id) AS retained_users
FROM (
  SELECT
    person_id,
    min(toDate(timestamp)) OVER (PARTITION BY person_id) AS first_day,
    toDate(timestamp) AS play_day
  FROM events
  WHERE event = 'round_finished'
)
WHERE day_offset IN (0, 1, 7)
GROUP BY day_offset
ORDER BY day_offset
```

### 2. Active Groups on Day 7

Leagues created on Day 0 that have $\ge 3$ distinct members finishing a round on Day 7:

```sql
SELECT
  properties.league_id AS league_id,
  count(DISTINCT person_id) AS active_members_d7
FROM events
WHERE event = 'round_finished'
  AND properties.league_id IS NOT NULL
GROUP BY league_id
HAVING active_members_d7 >= 3
```

### 3. Viral Coefficient $K$

Tracked as the funnel:
`share_completed` $\rightarrow$ `invite_link_opened` (with `ref`) $\rightarrow$ first `round_finished` from `ref` $\rightarrow$ `league_created`.
$$K = (\text{average invites opened per active player}) \times (\text{opened-to-first-play conversion})$$

### 4. Pro Conversion

New `subscription_started` events divided by weekly active players (`round_finished` distinct users over 7 days), plus `paywall_viewed` $\rightarrow$ `checkout_started` $\rightarrow$ `subscription_started` funnel conversion.
