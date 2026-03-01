# Bot-Wave — Own Your AI

[![Live](https://img.shields.io/badge/Live-botwave.app-f59e0b?style=flat-square)](https://botwave.app)
[![License](https://img.shields.io/badge/License-MIT-10b981?style=flat-square)](LICENSE)
[![Agents](https://img.shields.io/badge/Agents-15%2B_Running-10b981?style=flat-square)]()
[![API Cost](https://img.shields.io/badge/API_Cost-%240%2Fmo-f59e0b?style=flat-square)]()

**The first AI Agent OS that runs on your hardware, costs $0 in API fees, and is controlled from your phone.**

## Architecture

```
Phone (Telegram) → OpenClaw Gateway → Model Router → LM Studio ($0)
                        │                   │
                   Bash Pre-Process    Groq Free ($0)
                   Cron Scheduler      xAI/Mistral (paid fallback)
                   Audit Logger        Response Cache
```

## The Bash-Pipe Method

90% of "AI tasks" are text processing. Pre-process with `grep/awk/jq` before any model. Result: 15 agents for ~$5/mo instead of $150/mo.

## Self-Hosting

**[botwave.app/self-host](https://botwave.app/self-host.html)** — Full guide. Requirements: laptop, 8GB+ RAM, LM Studio, Node.js.

```bash
npm install -g openclaw && openclaw init && openclaw deploy captain --platform telegram
```

## Pricing

| Tier | Price | Agents | Key Feature |
|------|-------|--------|-------------|
| Free | $0/mo | 1 demo | Unlimited conversations |
| Pro | $29/mo | 3 | Multi-platform + Stripe |
| Boss | $49/mo | Unlimited | Self-hosted + local models |
| Operator | $99/mo | Unlimited | Security toolkit + OSINT + orchestration |

---
Built solo. Bootstrapped. Ships daily.
