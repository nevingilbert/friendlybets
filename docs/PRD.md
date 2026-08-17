# FriendlyBets — Product Requirements

## What it is

A web app for making casual bets with people you know. One person creates a lobby, shares
a link, and everyone in it can post propositions, take the other side, and settle up.

It is not a gambling product. Stakes are freeform text — "a shot", "loser does the
dishes", "$5" — and no money moves through the app. Outcomes are called by the two people
in the bet, on the honour system.

## Who it's for

Anyone with a group and something to argue about: a Super Bowl party, a season-long
running joke between friends, an office pool. The original build targeted a single
party on a single WiFi network; lobbies generalise that to any group, anywhere.

## Goals

- A guest goes from a shared link to placing a bet in under a minute, on a phone, with no
  install and no account to create.
- Everyone in a lobby sees activity update live, including a big-screen view for a room.
- A lobby is private. Its bets, players and standings are visible only to people who
  joined it.
- Costs nothing to run at party scale (Supabase and Vercel free tiers).

## Non-goals

These are deliberate. They keep the product honest about what it is.

- **No automated outcome verification.** No sports data feeds. Participants call it.
- **No real money.** No payments, no escrow, no balances. Stakes are text.
- **No dispute resolution.** First resolution stands. Both people in a bet can call it,
  and the app assumes friends will not lie to each other's faces. A voting or arbitration
  flow would add real complexity to solve a social problem.
- **No multi-outcome markets.** Every bet is binary — YES or NO. A "who scores first?"
  market needs a different matching model.
- **No public or open lobbies.** You get in via a link or a code, from someone who has it.

## Roles

**Player.** Anyone in a lobby. Can post bets, take bets, resolve bets they're part of, and
mark stakes paid. Can leave the lobby.

**Host.** Whoever created the lobby. Everything a player can do, plus: rename the lobby,
control whether it accepts new players, remove players, delete any bet, and reopen a bet
that was accepted by mistake.

Host powers are enforced in the database, not the interface. The previous version put its
admin panel behind an unlisted URL (`/admin-x7k9m2`) with no server-side check at all,
which meant anyone who found or guessed it could delete anyone's bets.

## Core concepts

### Lobby

A named group with a six-character join code and an invite link. Codes use an alphabet
that excludes `0/O` and `1/I` so they survive being read aloud across a room.

A lobby is `OPEN` (anyone with the link can join), `LOCKED` (no new players, betting
continues), or `ARCHIVED` (read-only, no new bets).

### Bet

| Field | Meaning |
|---|---|
| Proposition | A yes/no statement — "the first play is a run" |
| Stake | Freeform text, the same for both sides |
| Creator + side | Who posted it and whether they're on YES or NO |
| Acceptor | Whoever took the opposite side |
| Status | Where it is in the lifecycle |
| Outcome | YES or NO once called |

Stakes are symmetric: taking a bet means risking the same thing the creator did.

### Lifecycle

```
OPEN ──accept──> ACCEPTED ──resolve──> RESOLVED ──complete──> COMPLETED
  │
  └──cancel──> CANCELLED
```

- **Open** — waiting for someone to take the other side.
- **Accepted** — both people are locked in.
- **Resolved** — the outcome has been called; the app derives who won and who owes.
- **Completed** — the loser's stake has been paid.
- **Cancelled** — the creator pulled it before anyone took it.

## Screens

**Sign in (`/`)** — what the app does, and one Google button. Signed in, this becomes your
list of lobbies with buttons to create one or join by code.

**Invite (`/join/:code`)** — readable *before* signing in, so the page can say "Nevin
invited you to Super Bowl Sunday · 6 players". Signing in from here joins automatically
and drops you in the lobby.

**Feed (`/lobby/:id`)** — the main screen. Tabs for Open / Mine / All, the player strip,
and a button to post a bet. Open bets show what you'd be taking: "Take NO — a shot".

**Bet detail** — the full picture and whatever action is yours to take.

**Big screen (`/lobby/:id/dashboard`)** — for a TV or laptop in the room. Live counts, a
rotating ticker of bets needing a taker, an activity feed, standings, and a QR code so
anyone can join by pointing a camera. Read-only and sized to be read from across a room.

**Lobby settings (`/lobby/:id/manage`)** — the roster for everyone, plus leave-lobby for
players. Hosts additionally get rename, join control, remove player, and bet moderation.

## Identity

Google sign-in, and nothing else. It gives every player a real, verified identity, which
is what lets the database enforce who may do what. Display name and avatar come from the
Google profile; nothing else is stored.

The previous version identified people by name plus phone number, unverified — anyone
could claim to be anyone by typing their number, and it meant real phone numbers in the
database. Both problems disappear with OAuth, and signing in is fewer taps than typing a
phone number.

## Privacy

- Only a display name and avatar URL are stored per person.
- You can read another player's profile only while you share a lobby with them.
- Lobby contents are visible only to members.
- No phone numbers, no analytics, no third-party trackers.

## Success criteria

- Link tap to first bet placed: under a minute on a phone.
- Updates land on every screen in a lobby within a second.
- The big-screen view is readable from ten feet away.
- 20–30 people in a lobby with no degradation.
- A whole evening of use without a reload.

## Deliberate simplifications

Worth stating so they don't read as bugs:

- **One acceptor per bet.** First to tap gets it, enforced with a row lock.
- **Both sides risk the same stake.** No odds, no asymmetric stakes.
- **Anyone in the bet can resolve it**, and the first call is final.
- **Names are cosmetic.** Two players can share a display name; identity is the Google
  account.
- **Leaving a lobby doesn't erase your bets.** They stay on the board; your name resolves
  to "a former player" for people who can no longer see your profile.

Ideas that were considered and not built are in [ROADMAP.md](ROADMAP.md).
