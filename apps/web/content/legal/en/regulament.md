# RonDuel Game Rules

**Last updated: [DATA] (proposal: December 1, 2026)**
**Version: 1.0**

In short: one round per day, the same for everyone, lasting about one minute. Correct answers earn points, and fast ones earn a bonus. Everything is measured on our server. You play with friends in leagues and duels. There is no real-money betting and no cash prizes.

These rules supplement the [Terms and Conditions](https://ronduel.eu/en/legal/terms). If the two texts conflict, the Terms and Conditions apply.

The operator of RonDuel is Pixel-WebAPP SRL, CUI 54870881, Trade Registry No. J2026038031009, registered office at [STRADA, NR.], Mangalia, Constanța County, Romania, email contact@pixel-webapp.ro.

---

## 1. What RonDuel is and what it is not

1.1. RonDuel is a daily general knowledge and logic game played with friends. Your result depends on your knowledge, reasoning, and speed.

1.2. **It is not gambling and has no prizes.** You pay no stake to participate. There are no cash prizes, physical items, vouchers, or other benefits. Points, streaks, trophies, and leaderboards have no monetary value, cannot be exchanged for money, and cannot be transferred (Art. 7 of the Terms).

1.3. **The core game is free.** You can play the daily round, create and join leagues, and play duels without paying anything, within the limits in Art. 7.4. The RonDuel Pro subscription is optional and paid (Art. 12).

## 2. The Daily Round

2.1. **One round per day, the same for everyone.** For each calendar date there is a single round. Everyone on the same calendar date receives the same questions, in the same order and with answer options in the same order. Each round has a number (for example #142), which increases by 1 every day after launch.

2.2. **When the new round appears.** The new round unlocks at **local midnight**, meaning 00:00 in your device's time zone (the Wordle model). You always play the round corresponding to your local date. The date is calculated by our server based on server time and the time zone reported by your device. We do not use the clock date displayed by your phone.

2.3. **Changing your time zone.** The time zone stored on your account can change **at most once every 24 hours**. Every change is logged so nobody can "jump" into a future day to preview the round early.

2.4. **What the round contains.** Typically, a round has **6 questions**:

- 2 multiple-choice questions (one correct option out of 4);
- 1 ordering question (arrange 4 items in the requested order);
- 1 "odd one out" question (pick the option that does not belong);
- 2 logic or calculation questions (with 4 options).

The composition of a round may vary. You see the number of questions and each time limit in the app before starting.

2.5. **Time per question:**

- each question has a standard limit of **30 seconds** (6 questions = ~3 minutes).

A typical round takes around 3 minutes.

2.6. **Question language.** If a question does not yet have a verified translation in your language, you receive it in English, marked with the "EN" badge.

## 3. One Attempt Per Day

3.1. You may play the daily round **only once per day**, with a single account.

3.2. **When the attempt begins.** Before starting you see the "Ready?" screen and a 3-2-1 countdown. **The attempt begins the moment the server sends you the first question.** From that moment the round counts and cannot be restarted.

3.3. **If you leave the game.** If you close the page, lose connection, or press "back", your attempt does not reset. When you return, you continue with the next unanswered question. The question you left counts as **timed out (0 points)** because its timer kept running on the server.

3.4. **If you do not return the same day.** [TO BE CONFIRMED: the specification does not state what happens to an unfinished round started before midnight. Proposal: at the end of your local day the round closes automatically. Unanswered questions receive 0 points, and the score earned so far enters the leaderboards and keeps your streak active.]

## 4. How Points Are Calculated

4.1. **Correct answer: 100 points + speed bonus.**
**Wrong answer or time expired: 0 points.**

4.2. **Speed bonus formula:**

> bonus = round( 100 × max(0, (limit − time) / limit) )

where:

- **limit** = the question time limit (30 seconds);
- **time** = the elapsed time measured **on our server**, from the moment the question was sent to you until your answer arrived, **minus 250 milliseconds** for network latency. Time cannot be less than 0;
- **round** = rounding to the nearest integer.

The faster you answer, the higher the bonus. A correct answer earns between 100 and 200 points.

4.3. **Examples** (30-second question, correct answer):

- answer received by server after 6.25 s: time = 6 s, bonus = round(100 × 24/30) = 80, total **180**;
- answer received after 15.25 s: time = 15 s, bonus = round(100 × 15/30) = 50, total **150**;
- answer received after time expired: **0 points**. [TO BE CONFIRMED: the specification does not state whether the 250 ms grace also applies to the timeout check. Proposal: the grace applies only to the bonus calculation, while the timeout limit remains 30 s measured on the server.]

4.4. **Maximum score: 1,200 points per day** (6 questions × 200).

4.5. **Ordering questions** are scored "all or nothing": you earn points only if all 4 items are in the exact order.

4.6. **The on-screen timer is informational only.** Only server-measured time counts for points. You see the correct answer only after you answer or time expires. At the end you can review all answers with explanations.

4.7. **Extended time (accessibility setting).** In Settings you can enable "Relaxed timer", which gives you **50% more time** on each question. Rounds played this way count in leaderboards but are marked with a small badge. [TO BE CONFIRMED: if the bonus is calculated using the extended limit, the same response speed earns more points than without the setting. Proposal: the extended limit applies only to timeout expiration, while the speed bonus uses the standard limit.]

## 5. Ties

5.1. **Daily leaderboard.** On an equal score, the player with the **lower total time** (sum of server-measured times) wins. If total time is also tied, the player who **finished the round earlier** wins.

5.2. **Weekly leaderboard and trophy.** On an equal weekly score, the player with **fewer total seconds** in that week wins. [TO BE CONFIRMED: what happens if total time is also tied. Proposal: the trophy is awarded to all tied players.]

5.3. **Duels.** See Art. 8.4.

## 6. Leaderboards

6.1. Each league has three leaderboards:

- **Today**: scores from today's round;
- **This week**: sum of daily scores in the league week; missed days count as 0;
- **All-time**: total score, rounds played, weekly trophies won, and longest streak.

6.2. **No spoilers.** Until you finish today's round, you cannot see other members' scores for today. You only see who has played.

6.3. **League day and week.** A league's day and week are calculated in the **league's time zone**, set at creation from the creator's device and changeable by the owner. **The league week runs Monday 00:00 to Sunday 23:59:59**, league time.

6.4. [TO BE CONFIRMED: league members may be in different time zones. Proposal: your score enters the league day matching the calendar date of the round you played, and time zone changes apply starting the following week.]

6.5. Only the daily round counts in leaderboards. Archive rounds and extra practice rounds **do not count** (Art. 12.3).

## 7. Leagues

7.1. **Creating a league.** After your first round, if you are not in a league, you can share your result to your group chat. The shared link automatically creates a league with a generated name and a 6-character invite code.

7.2. **Joining a league.** Anyone opening the invite link sees the league name, members, and today's standings, and can join with one button by picking a nickname unique in that league.

7.3. **Joining mid-week.** You can join a league anytime. Days before joining count as 0 in the weekly standings.

7.4. **Free account limits.** Currently, a free account can:

- create up to **1 league**, with up to **5 members** (including yourself);
- be a member of up to **10 leagues**;
- have at most **4 duels per month** (and 1 active duel at a time).

7.5. **League owner** (one per league) can:

- change the league name and time zone;
- rename or remove a member;
- transfer ownership to another member.

7.6. **Leaving a league.** You may leave a league anytime. [TO BE CONFIRMED: how weekly/all-time scores and owner departure are handled. Proposal: scores remain anonymized and ownership transfers to the oldest member.]

7.7. **Account deletion.** If a member deletes their account, their scores remain in leaderboards under "Former player" (Art. 5.6 of the Terms).

## 8. 1v1 Duels

8.1. **What a duel is.** A duel is a separate **5-question** mini-round played by two players, not necessarily at the same time. Duel questions come from a separate pool and never overlap with today's round or the next 7 days' rounds.

8.2. **Who can play.** You can challenge a league member or send an open duel link to anyone.

8.3. **Scoring.** Duels use the same scoring formula as the daily round (Art. 4), with a maximum score of 1,000 points. [TO BE CONFIRMED: explicit confirmation that the scoring formula is identical.]

8.4. **Who wins.** The higher score wins. On a tie, the **lower total time** wins. [TO BE CONFIRMED: full tie behavior. Proposal: the duel ends in a draw.]

8.5. **Time windows and expiration:**

- each player has **24 hours** to play their part;
- if the opponent does not start within 24 hours of creation, the duel **expires** with no winner;
- if the challenger finished their part and the opponent does not play within 24 hours after that, the challenger wins **by walkover**.

[TO BE CONFIRMED: partial duel attempt expiration and open-link opponent assignment.]

8.6. **Where results appear.** Results appear on the duel page and in the league feed. We track a head-to-head win-loss record for each pair. **Duels do not add points to league leaderboards.**

## 9. Streaks

9.1. Your streak increases by 1 for each consecutive local day on which you **finish** the daily round. Missing a day resets it to 0. We also record your best streak.

9.2. **Streak shield (Pro only).** Pro subscribers automatically get one shield per ISO week (Monday to Sunday), covering one missed day without losing the streak. Shields do not carry over. [TO BE CONFIRMED: whether the shield's ISO week uses the player's local time zone.]

## 10. Fair Play and Anti-Cheat

10.1. **What counts as cheating.** It is prohibited to:

- use scripts, bots, extensions, or automated tools that answer for you;
- use multiple accounts to replay the same round, preview questions, or inflate a league;
- manipulate time zones, clocks, or server requests;
- attempt to intercept or modify app data to see answers beforehand;
- publish today's questions or answers before the day ends to give someone an advantage. [TO BE CONFIRMED: adoption of this rule.]

10.2. **How we detect it.** All points and times are computed server-side. Correct answers never reach the client before you answer. We flag for human review without auto-blocking:

- rounds where **at least 3 answers** arrived in less than **0.4 seconds**;
- multiple accounts from the same device or IP playing in the same league on the same day.

10.3. **Penalties**, proportional to severity:

- **voiding the score** of a round or duel and recalculating leaderboards;
- temporary feature restrictions;
- **account suspension or termination** for severe or repeated violations.

[TO BE CONFIRMED: whether a weekly trophy can be revoked and re-awarded within 7 days after a score is voided.]

10.4. **Explanation and appeal.** For any penalty you receive an explanation and may appeal under **Art. 9 and Art. 13 of the Terms and Conditions** (https://ronduel.eu/en/legal/terms).

## 11. Question Errors and Technical Issues

11.1. **Wrong question.** If you find an erroneous or ambiguous question, contact us at contact@pixel-webapp.ro.

11.2. **How we handle points.** [TO BE CONFIRMED: proposal to grant 100 + normal speed bonus to everyone who answered an erroneous question before timeout.]

11.3. **Your technical issues.** Connection, device, or browser issues do not grant a new attempt. Art. 3.3 applies.

11.4. **Our technical issues.** [TO BE CONFIRMED: proposal for server outage remedies and streak protection.]

11.5. If you disagree with a decision under this article, write to contact@pixel-webapp.ro (Art. 16 of the Terms).

## 12. What You Get With RonDuel Pro

12.1. Pro is an optional paid subscription governed by the [Pro Terms](https://ronduel.eu/en/legal/terms). Pro includes:

- leagues up to **200 members**, private leagues with join approval, and custom league emoji/color;
- **unlimited duels**;
- **archive** of past rounds;
- **extra rounds** (themed practice packs);
- **advanced statistics** (topic accuracy, speed trends, head-to-head records);
- visual **themes**;
- weekly **streak shield** (Art. 9.2).

12.2. **Pro does not give extra points.** Subscribers play the daily round under the exact same conditions as everyone else.

12.3. **Archive rounds and extra rounds** are for fun and practice only and **do not count** toward league leaderboards, trophies, or streaks. [TO BE CONFIRMED: extending the archive rule explicitly to extra rounds.]

12.4. The streak shield may affect the displayed streak, and unlimited duels may affect head-to-head duel counts, without affecting daily, weekly, or all-time leaderboard points.

## 13. Changes to the Rules

13.1. We may update these rules and announce major changes in the app at least **7 days** in advance, taking effect at the start of the next game week. [TO BE CONFIRMED: 7-day notice period vs. 30 days in the Terms.]

13.2. The last updated date is shown at the top and bottom of the page.

## 14. Contact

Questions about the rules: contact@pixel-webapp.ro.

---

_Last updated: [DATA] (proposal: December 1, 2026)_
