# Reddit Content Strategy — Script Keepers Edition

> **Motto: "We don't waste tokens. We pipe and execute."**
> Every post is a script. Every comment adds value. No spam. No links. No selling.

---

## Subreddit Target List (with direct links)

### Tier 1 — Post here FIRST (most receptive)
| Subreddit | Members | Why it fits | Link |
|-----------|---------|-------------|------|
| r/selfhosted | 400K+ | Self-hosting is the core message | https://reddit.com/r/selfhosted |
| r/LocalLLaMA | 266K+ | Local model community, loves technical breakdowns | https://reddit.com/r/LocalLLaMA |
| r/AI_Agents | 90K+ | Literally about AI agent builders | https://reddit.com/r/AI_Agents |

### Tier 2 — Post 24-48h after Tier 1 (different angle per sub)
| Subreddit | Members | Why it fits | Link |
|-----------|---------|-------------|------|
| r/homelab | 810K+ | Hardware + infra audience, loves setup photos | https://reddit.com/r/homelab |
| r/SideProject | 430K+ | Explicitly allows project showcases if you lead with story | https://reddit.com/r/SideProject |
| r/opensource | 200K+ | Open source tools = welcome | https://reddit.com/r/opensource |
| r/LocalLLM | 119K+ | Privacy-focused local LLM runners | https://reddit.com/r/LocalLLM |

### Tier 3 — Use carefully (strict rules)
| Subreddit | Members | Rules | Link |
|-----------|---------|-------|------|
| r/raspberry_pi | 3.2M | Must include photo + technical detail | https://reddit.com/r/raspberry_pi |
| r/Entrepreneur | 4.8M | NO links, NO pitches. "Thank You Thursday" only | https://reddit.com/r/Entrepreneur |
| r/smallbusiness | 2.2M | Business lessons only, zero product mentions | https://reddit.com/r/smallbusiness |
| r/ChatGPTCoding | varies | Code-focused, show implementation details | https://reddit.com/r/ChatGPTCoding |

### AVOID — Will flag/ban you
- r/MachineLearning (academic only, needs papers)
- r/technology (news only, no self-promo)
- r/programming (strict no self-promo)

---

## POST VARIANT 1 — r/selfhosted + r/LocalLLaMA + r/AI_Agents

### Title
"I run 15 AI agents on my laptop for $0/month. The trick is bash pipes."

### Body

I'm a plumber. Zero CS degree. Got tired of paying per token so I figured out how to run everything local.

6 months of trial and error later: 15 specialized agents on an old ThinkPad. Sales, content, research, invoicing, social media. All running 24/7. Monthly cost: $0.

Here's the actual architecture:

**The bash-pipe trick (this is 90% of it)**

Most "AI tasks" are text routing. Before any prompt hits any model, bash handles the easy stuff:

```bash
# 1. Route by keyword — free, instant, no tokens burned
echo "$msg" | grep -qi "invoice\|quote\|estimate" && ROUTE=jobsite
echo "$msg" | grep -qi "price\|competitor\|market" && ROUTE=scout

# 2. Validate before calling — don't waste a call on empty input
[ -z "$msg" ] && echo "Empty input" && exit 0

# 3. Cache with TTL — same question within 24h = $0
HASH=$(echo "$prompt" | md5sum | cut -d' ' -f1)
if [ -f "cache/$HASH.json" ] && [ ! $(find "cache/$HASH.json" -mmin +1440) ]; then
  cat "cache/$HASH.json" && exit 0
fi

# 4. Compress context before inference — 10K tokens → 500
echo "$convo" | jq '.messages[-5:]'

# 5. Only extract what you need from the response
curl -s localhost:1234/v1/chat/completions -d "$payload" | jq '.choices[0].message.content'

# 6. Store result in cache for next time
echo "$response" | tee "cache/$HASH.json"
```

Six layers of defense before a paid token ever gets burned. That alone cuts model calls by 80-90%. The rest goes to:

**Model routing (all free)**
- Local: LM Studio on port 1234 (7B quant, CPU inference)
- Fallback chain: Groq free tier → Cerebras free → OpenRouter free → GitHub Models free
- Paid API: literally last resort, haven't hit it in weeks

**Agent orchestration**
- Each agent has its own session, personality, and routing rules
- Telegram as control plane — message from phone, response from laptop
- Cron scheduler for automated tasks (content posting, market reports, lead nurturing)
- Tailscale for remote access when I'm on a job site

**The script factory**
Every automation gets saved as a reusable bash script. 80+ scripts and growing. Pentest tools, content pipelines, invoice generators, data scrapers. The library is the real product.

Recently built a desktop app to manage the whole fleet — live status, one-click deploy from templates, swap models per agent. Still beta.

Hardware: 8GB RAM minimum, 16GB recommended. No GPU needed. CPU inference on 7B models is surprisingly usable for business tasks.

The whole thing is open source. I wrote up the full setup guide — project is called Botwave, you can find it if you search for it or check my profile.

Happy to answer technical questions about the bash-pipe approach, model routing, or agent orchestration.

---

## POST VARIANT 2 — r/homelab

### Title
"My homelab runs 15 AI agents 24/7 on a single ThinkPad for $0/mo API cost"

### Body

Posting my setup since I haven't seen many AI agent homelabs on here.

**Hardware**
- ThinkPad (16GB RAM, no GPU)
- LM Studio running locally on port 1234
- Everything on a single machine

**Stack**
- LM Studio → local 7B model inference (CPU, ~8-12 tok/s)
- Custom orchestrator → routes messages to specialized agents
- Telegram → control plane from my phone
- Tailscale → remote access from anywhere
- Cron scheduler → automated daily tasks (content, reports, lead follow-ups)
- Bash pre-processing → 90% of routing happens before any model gets called

**The agents (15 total)**
- General chat (customer FAQ)
- Sales closer (proposals, follow-ups)
- Content writer (social media, blog)
- Invoice generator (estimates, receipts)
- Competitive research (market intel)
- System monitor (health checks, alerts)
- 9 more gateway bots for specific tasks

**How it costs $0**
1. Bash pipes handle text routing before inference (free)
2. Response caching — same question never hits a model twice (free)
3. Local model for 90% of tasks (free)
4. Groq/Cerebras/OpenRouter free tiers for the 10% that needs 70B (free)
5. Paid API is last-resort failover — haven't triggered it in weeks

**What I'd change**
- Want to move to a dedicated Pi 5 (8GB) so the laptop stays free
- Need better model swapping (currently manual per agent)
- Wish I started with bash pre-processing sooner — it's the single biggest cost saver

The orchestrator is open source — project called Botwave. Search for it or check my profile. Happy to share configs if anyone wants to replicate.

---

## POST VARIANT 3 — r/SideProject

### Title
"I'm a plumber who built an AI agent OS. 15 bots, $0/mo, runs on my laptop."

### Body

No CS degree. I learned to code by Googling errors and reading Stack Overflow at 2am after plumbing jobs.

**What I built**
An orchestration system that runs 15 AI agents on a single laptop. Each agent has a job — sales, content, research, invoicing, monitoring. They communicate through Telegram, run on local models, and cost $0/month in API fees.

**Why I built it**
Was paying $150+/mo for cloud AI tools that did basic text processing. Realized 90% of what I was paying for could be done with bash scripts and a local 7B model. So I stopped paying.

**The journey (6 months)**
- Month 1: Got LM Studio running, first local chatbot
- Month 2: Built the bash pre-processing layer (this changed everything)
- Month 3: Multi-agent routing, each bot specialized
- Month 4: Telegram integration, control from phone
- Month 5: Cron automation, agents work while I'm on job sites
- Month 6: Desktop app, script factory (80+ reusable scripts)

**What actually makes money**
- The agents handle my real plumbing business operations
- I also turned the system into a product (subscription tiers)
- Hardware kit version coming (pre-flashed Raspberry Pi)

**Stack**
Local models + bash pipes + free API fallback chain + Telegram control plane. All open source tools. The value isn't the code — it's knowing how to wire it all together.

**Biggest lesson**
You don't need GPT-4 for 90% of business automation. A well-prompted 7B model with good context management handles invoices, content, research, and customer chat just fine.

Project is called Botwave. It's on my profile if you want the self-hosting guide.

---

## POST VARIANT 4 — r/raspberry_pi (when Node ships)

### Title
"Built a 3D-printed AI agent box running on Pi 5 — 5 bots, 0dB, $0.30/mo electricity"

### Body
*(Include photo of the 3D-printed case with Pi inside)*

Specs:
- Pi 5 (8GB)
- 128GB NVMe via USB adapter
- Custom 3D-printed case (STL files in comments)
- LM Studio + Qwen 2.5 3B + Phi-3 Mini + TinyLlama
- 5 AI agents running 24/7 via Telegram
- 15W idle, 0dB fanless
- Setup time: 3 minutes (pre-flashed image)

*(Then share technical details, thermals, token speed benchmarks)*

---

## PRE-WRITTEN COMMENT REPLIES

**Q: "How does the bash caching actually work?"**
> Dead simple. Hash the prompt with md5sum, check if a file with that hash exists and is less than 24h old. If yes, cat it and exit — zero API call. If no, call the model, pipe the response through jq to grab only what you need, tee it into the cache file. Six lines of bash. Saved me thousands of calls. The cache hit rate on routine business queries is like 70-80% because customers ask the same stuff constantly.

**Q: "What models?"**
> Local: whatever fits in RAM — I usually run 7B quants on 16GB, 3B on 8GB. Cloud fallback: Groq/Cerebras/OpenRouter all have free tiers with larger models. I route by task complexity.

**Q: "How is this different from Ollama/CrewAI/n8n?"**
> Those are pieces of the puzzle. Ollama runs models. CrewAI orchestrates agents. n8n does workflows. What I built is the full stack: model routing + bash pre-processing + cron scheduling + multi-platform deployment + audit logging + caching. One system, 15 agents, $0.

**Q: "Can this actually run a business?"**
> It IS running my business. I'm a plumber — invoices, lead follow-ups, content scheduling, competitive research. 90% of business automation doesn't need frontier models.

**Q: "Privacy/security?"**
> Gateway is loopback-only. Password auth. Credentials chmod 600. Full audit logs. Security-sensitive agents are hardcoded to local-only — they never touch cloud APIs.

**Q: "Link?"**
> Project is called Botwave. Check my profile or search "botwave app self-host" — I put together a full setup guide. Core is open source.

**Q: "How much does it cost?"**
> Free tier works fine for most people. There are paid tiers if you want the full fleet templates and desktop app. But the self-hosting guide is free and covers everything you need to replicate what I built.

---

## ANTI-SPAM RULES (Script Keeper Protocol)

1. **NEVER post a direct URL** — use "botwave (dot) app" or "check my profile" or "search for botwave self-host"
2. **NEVER mention pricing** in the post itself — let people discover tiers on the site
3. **NEVER say "check out"** or "buy" or "subscribe" — say "I put together a guide" or "it's on my profile"
4. **NEVER post the same content** to two subs — each variant is unique
5. **Lead with technical value** — the product mention goes in the last 10% of the post
6. **Answer every comment** — Reddit algorithm rewards engagement
7. **Space posts 24-48h apart** — never post to multiple subs same day
8. **Build karma first** — comment genuinely on 5-10 posts in each sub before posting your own
9. **No emojis, no hype** — Reddit hates marketing energy. Sound like an engineer sharing notes.
10. **"Happy to answer questions"** — always end with this. It signals community, not sales.

## POSTING SCHEDULE

| Day | Action |
|-----|--------|
| Day 1-3 | Comment on 10 posts in r/selfhosted and r/LocalLLaMA (genuine, helpful) |
| Day 4 | Post Variant 1 to r/selfhosted |
| Day 5 | Engage all comments on r/selfhosted post |
| Day 6 | Post Variant 1 to r/LocalLLaMA (slightly adjusted title) |
| Day 7 | Engage comments, post Variant 1 to r/AI_Agents |
| Day 8-9 | Comment on posts in r/homelab and r/SideProject |
| Day 10 | Post Variant 2 to r/homelab |
| Day 12 | Post Variant 3 to r/SideProject |
| Day 14+ | Variant 4 to r/raspberry_pi (when Node hardware is ready + photo) |
