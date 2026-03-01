# SGKx1904 Arcade Redesign — Design & Implementation Plan

## Vision
Merge all site pages into a single-page arcade experience. "Choose Your Fighter" character select as the hook. Telegram Mini App as the mobile-native version. Hard sell the concept: free bots prove it works, paying unlocks the uncensored off-grid power.

## Site Flow (single index.html)

1. **CHOOSE YOUR FIGHTER** — MK2-style character select grid, ASCII art avatars
2. **FORGE YOUR OWN** — Bot builder wizard (condensed from create.html)
3. **UPGRADE YOUR ARSENAL** — Pricing tiers as power-up levels
4. **THE ORIGIN STORY** — Brief proof + stats + terminal output
5. **Footer** — Links, legal, Telegram, Nostr

## Roster

### Public Fighters (clickable, link to Telegram)
| Name | Role | Link |
|------|------|------|
| Captain Obvious | Free AI Demo | @CaptainObvious_bot |
| Mitch | Business AI | @moneymakingmitch1904_bot |
| PaperChase | Finance & Crypto | @paperchaserSGK_bot |
| Banksy | Graphic Designer | @banksySGK_bot |
| JobSite | Blue Collar Biz | @jobsiteSGK_bot |

### Locked Fighters (coming soon, dimmed)
| Name | Role |
|------|------|
| Scout | Research Intel |
| Scribe | Content Writer |
| Closer | Sales Specialist |
| Ghost | Marketing Engine |
| CodeBot | Software Builder |
| Oracle | News Intelligence |

### Mystery Fighter (Boss tier only)
- Glitched/static ASCII silhouette
- Name: "???" or "[REDACTED]"
- Tagline: "No rules. No filters. No cloud. Boss tier only."
- No details exposed — pure intrigue

## Visual System
- **Fonts**: Cinzel (headings), JetBrains Mono (body), Press Start 2P (arcade titles)
- **Colors**: Crimson #DC143C, Gold #D4AF37, Bone #E8DCC8, CRT Blue #00d4ff
- **Effects**: CRT scanlines, pixel noise, glow/bloom on hover, screen flicker
- **Icons**: ASCII art avatars, Lucide SVG for UI, CSS shapes — ZERO emoji
- **Responsive**: 4-col desktop, 2-col tablet, 1-col mobile

## Multi-Platform Deployment (10+ platforms)
Whatever OpenClaw supports, we advertise. Full list from source code:

### Core Channels
- **Telegram** (live demos here)
- **Discord** (gaming/community audience — huge)
- **Slack** (business/enterprise users)
- **Signal** (privacy-first crowd — perfect for our brand)
- **iMessage** (Apple users)
- **Web Chat** (embed widget on any website)

### Extension Channels
- **Microsoft Teams** (corporate/enterprise)
- **Matrix** (open-source/decentralized community)
- **Zalo** (Southeast Asian market)
- **Voice Call** (phone-based AI assistant)

### Marketing Note
- **NO WhatsApp** — scam association, drop from all marketing
- **Main app focuses on Telegram** — that's where live demos are
- Multi-platform support is a FOOTNOTE, not the headline
- Small "Also available on 10+ platforms" line near footer or pricing section
- Don't overwhelm the main pitch with platform logos

## Telegram Mini App (app.html)
- Same character select UI, mobile-optimized
- Uses `window.Telegram.WebApp` API
- Haptic feedback on character selection
- "Select Fighter" opens bot chat directly in Telegram
- Dark theme matching Telegram dark mode
- Hosted at zombie760.github.io/app.html
- Configured via BotFather `menubutton` command

## Implementation Steps

### Phase 1: Build the merged index.html
1. Create ASCII art for each of the 12 characters (5 public + 6 locked + 1 mystery)
2. Build the character select grid with hover/click interactions
3. Build the detail panel (bio, stats, abilities, "SELECT" button)
4. Port the bot forge wizard from create.html (restyled)
5. Build pricing section as arcade power-up tiers
6. Build condensed origin story + terminal section
7. Add CRT effects, scanlines, pixel noise, Press Start 2P font
8. Responsive layout for mobile
9. Remove all emoji, replace with ASCII/SVG/CSS icons

### Phase 2: Telegram Mini App (app.html)
1. Create mobile-optimized version of character select
2. Integrate Telegram WebApp JS SDK
3. Add haptic feedback and native transitions
4. Configure BotFather menu button
5. Test in Telegram mobile client

### Phase 3: Bot Personality Overhaul
1. Rewrite each bot's SOUL.md with distinct voice
2. Remove copy-paste "built by a plumber" from every bot
3. Give each bot unique greeting, vocabulary, and style
4. Update stat bars to match each bot's actual specialty

### Phase 4: Deploy
1. Test locally
2. Push to GitHub Pages
3. Configure Telegram Mini App URL
4. Verify all bot links work

## Files to Create/Modify
- `index.html` — complete rewrite (merged site)
- `app.html` — new (Telegram Mini App)
- `select.html` — delete (merged into index)
- `create.html` — delete (merged into index)
- Bot SOUL.md files — rewrite for distinct voices

## OPSEC
- HOMIIEE (@Deth1_bot) — NOT listed anywhere
- Dick Tracy (@Dicktracy1904_bot) — NOT listed anywhere
- Mystery character hints at uncensored local model but reveals NOTHING specific
- No model names, no API details, no cost breakdowns in public content
