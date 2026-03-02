# Reddit Posting Workflow — Step by Step

> You're not "marketing." You're a builder sharing what you built.
> That's the only mindset that works on Reddit.

---

## THE VOICE (How to Sound)

**You ARE:**
- A plumber who figured this out on his own
- Tired, practical, no-bullshit
- Sharing notes, not selling a product
- The guy at the bar explaining his weekend project
- Slightly surprised it actually works

**You are NOT:**
- A founder launching a startup
- An influencer building a brand
- A marketer with a funnel
- Excited or hyped (Reddit HATES hype)

**Tone examples:**

| BAD (sounds like marketing) | GOOD (sounds like a person) |
|---|---|
| "Revolutionizing AI deployment!" | "Got tired of paying OpenAI so I figured it out myself" |
| "Check out Botwave!" | "The project is called Botwave if anyone wants to look" |
| "Zero cost AI solution" | "Monthly bill went from $150 to literally nothing" |
| "We offer self-hosting" | "I wrote up how to do it if anyone cares" |
| "Our agent framework" | "The thing I built" |
| "Sign up for free!" | "There's a free tier" |
| "Amazing results!" | "It works. Surprised me too." |

**Words to NEVER use on Reddit:**
- Revolutionary, game-changing, disruptive, innovative
- Check out, sign up, subscribe, join
- We, our, us (you're one person — say "I")
- Excited to announce, proud to share, thrilled
- Solution, platform, ecosystem (say "thing I built" or "project")

**Words that work on Reddit:**
- "I built", "I figured out", "here's how", "in case anyone's curious"
- "Not sure if anyone cares but", "might be useful to someone"
- "The trick is", "the part that surprised me", "what I'd do differently"
- "Happy to answer questions", "let me know if you want configs"

---

## PHASE 0: ACCOUNT PREP (Do this today, takes 10 min)

Your Reddit account needs to not look brand new or single-purpose.

1. **Set up your profile**
   - Username: use your existing account or make one that's NOT your brand name
   - Bio: "Plumber. Tinkerer. Run local AI on old hardware." (casual, human)
   - Do NOT put "botwave" or any URL in your bio yet

2. **Subscribe to these subs** (just click join):
   - r/selfhosted
   - r/LocalLLaMA
   - r/AI_Agents
   - r/homelab
   - r/SideProject
   - r/opensource
   - r/raspberry_pi

3. **Set Reddit to sort by "New"** — this shows fresh posts that need comments

---

## PHASE 1: BUILD KARMA (Days 1-5)

> You MUST do this before posting anything of your own.
> Reddit tracks your post/comment ratio. All posts + no comments = spam.

**Goal: 10-15 genuine comments across your target subs**

**How to find posts to comment on:**
1. Go to r/selfhosted → sort by "New"
2. Find someone asking a question you can answer
3. Leave a helpful reply (2-5 sentences)
4. Repeat in r/LocalLLaMA and r/AI_Agents

**What to comment on (easy karma):**
- "What's the best way to self-host X?" → share your experience
- "How do I run local LLMs?" → mention LM Studio, give a tip
- "Is Ollama better than X?" → give honest comparison
- "Anyone running AI on Raspberry Pi?" → share what you know
- "What free LLM APIs exist?" → mention Groq/Cerebras/OpenRouter
- "How do I reduce API costs?" → mention bash pre-processing trick

**Example comments:**

> On a post asking "How do I reduce OpenAI costs?":
>
> "Bash pre-processing saved me the most. Before any prompt hits a model, I route simple stuff through grep and jq — keyword matching, context compression, response caching. Cuts model calls by 80-90%. The remaining 10% goes to Groq's free tier (Llama 3.3 70B). Haven't paid for an API in months."

> On a post asking "Best local model for business tasks?":
>
> "Qwen 2.5 7B Instruct has been solid for me. Handles customer FAQ, content drafts, invoice generation, data extraction. Running it on CPU (no GPU) through LM Studio. Not as good as GPT-4 obviously, but for 90% of routine business tasks it's more than enough."

> On a post about self-hosting tools:
>
> "I run 15 agents through Telegram with local models on an old ThinkPad. The key was building a bash layer that handles routing before inference — most 'AI tasks' are just text matching. Happy to share the setup if you're interested."

**Rules for commenting:**
- Answer the question FIRST. Don't mention your project unless directly relevant.
- No links. Ever. Just knowledge.
- Sound like a person, not a brand.
- 2-5 comments per day across different subs. Don't spam 10 in one hour.
- Upvote other good replies in the thread (Reddit notices engagement patterns)

**Schedule:**
| Day | Sub | Comments |
|-----|-----|----------|
| Day 1 | r/selfhosted | 3 comments on different posts |
| Day 2 | r/LocalLLaMA | 3 comments |
| Day 3 | r/AI_Agents | 2 comments |
| Day 3 | r/homelab | 2 comments |
| Day 4 | r/selfhosted | 2 more comments |
| Day 5 | r/LocalLLaMA | 2 more comments |

By Day 5 you should have ~14 comments and some karma built up.

---

## PHASE 2: FIRST POST (Day 6)

**Where:** r/selfhosted (most welcoming to project showcases)

**When to post:** Tuesday, Wednesday, or Thursday. Between 8-10am EST or 12-2pm EST. These are peak Reddit hours for tech subs.

**What to post:** Use Variant 1 from reddit-post.md

**Before you hit "Post":**
1. Read it out loud. Does it sound like a person or an ad? If it sounds like an ad, rewrite.
2. Check: are there ANY direct links in the body? Remove them.
3. Check: does it mention price or tiers? Remove that.
4. Check: does the title sound clickbaity? Tone it down.
5. The word "Botwave" should appear exactly ONCE, near the end.

**After posting:**
- Stay online for 2 hours. Reply to EVERY comment within 30 minutes.
- First comments determine if Reddit's algorithm boosts or buries you.
- If someone asks a question: answer the technical part fully, THEN mention the project if relevant.
- If someone is negative: agree with their valid points, don't get defensive.
- If someone asks for a link: say "it's called Botwave — search 'botwave self-host' or check my profile"

**How to handle negative comments:**

| They say | You say |
|----------|---------|
| "This is just self-promo" | "Fair point. Mostly wanted to share the bash-pipe approach since I haven't seen it discussed much. Happy to remove the project mention if mods prefer." |
| "7B models suck" | "For GPT-4 level reasoning, yeah. But for routing invoices and writing social posts? Honestly works fine. The bash layer handles the heavy lifting." |
| "Why not just use CrewAI/n8n" | "Both are great. I needed tighter control over model routing and wanted bash pre-processing before inference. Different tradeoffs." |
| "Sounds too good to be true" | "It's not magic. The $0 part only works because 90% of my tasks are text routing that bash handles. The models do the remaining 10%." |

---

## PHASE 3: SECOND POST (Day 8-9)

**Where:** r/LocalLLaMA

**Wait at least 48 hours** after your r/selfhosted post.

**Adjust the title slightly:**
- r/selfhosted title: "I run 15 AI agents on my laptop for $0/month. The trick is bash pipes."
- r/LocalLLaMA title: "Bash pre-processing before local inference cut my model calls by 90%"

**Adjust the angle:** r/LocalLLaMA cares about models and inference. Lead with the technical details about model routing, quantization, token speeds. The "15 agents" stuff is secondary.

**Same rules:** Stay online 2 hours, reply to everything, no links.

---

## PHASE 4: THIRD POST (Day 10-11)

**Where:** r/AI_Agents

**Title:** "Built 15 specialized agents with bash-pipe routing and local models — $0/mo"

**Angle:** This sub cares about agent orchestration, tool use, multi-agent coordination. Lead with HOW the agents work together, not the cost savings.

---

## PHASE 5: EXPAND (Day 12+)

| Day | Sub | Variant | Angle |
|-----|-----|---------|-------|
| 12 | r/homelab | Variant 2 | Hardware setup, infra diagram |
| 14 | r/SideProject | Variant 3 | Founder story, plumber to builder |
| 16 | r/opensource | Variant 1 (trimmed) | Open source tools, contribution welcome |
| 20+ | r/raspberry_pi | Variant 4 | ONLY when you have a photo of the Node hardware |

---

## PHASE 6: ONGOING (Weekly)

Once you've posted, shift to maintenance mode:

- **3-5 comments per week** across your target subs (genuine, helpful)
- **Reply to any new comments** on your old posts (Reddit resurfaces active threads)
- **One new post per month MAX** — only when you have something genuinely new (Desktop app launch, Node hardware, ClawHub marketplace)
- **Never post the same thing twice** — each post must have a new angle or new content

---

## CHEAT SHEET (Print This)

```
BEFORE POSTING:
[ ] Built 10+ karma comments over 5+ days?
[ ] Posting Tue/Wed/Thu between 8-10am or 12-2pm EST?
[ ] Zero direct links in body?
[ ] Zero pricing mentions?
[ ] "Botwave" appears only once, near the end?
[ ] Read it out loud — does it sound human?
[ ] Title is factual, not hype?

AFTER POSTING:
[ ] Stay online 2 hours
[ ] Reply to every comment within 30 min
[ ] Answer technical questions FIRST, project mention second
[ ] Agree with valid criticism, don't get defensive
[ ] If asked for link: "search botwave self-host" or "check my profile"

WEEKLY MAINTENANCE:
[ ] 3-5 helpful comments in target subs
[ ] Reply to new comments on old posts
[ ] No new post unless genuinely new content
```

---

## TIMELINE SUMMARY

```
Day 1-5:   Comment phase (14 comments, build karma)
Day 6:     Post #1 → r/selfhosted
Day 8-9:   Post #2 → r/LocalLLaMA
Day 10-11: Post #3 → r/AI_Agents
Day 12:    Post #4 → r/homelab
Day 14:    Post #5 → r/SideProject
Day 16:    Post #6 → r/opensource
Day 20+:   r/raspberry_pi (when Node photo ready)
Weekly:    3-5 comments, reply to old threads
Monthly:   One new post IF you have new content
```

Total time investment: ~20 min/day for the first two weeks, then ~10 min/day ongoing.

The posts are already written in reddit-post.md. You just need to copy-paste them on the right day.
