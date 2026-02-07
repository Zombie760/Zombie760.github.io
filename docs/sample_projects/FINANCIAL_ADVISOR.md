## Job Description

**Create a research assistant system that generates automated daily financial reports**

Set up a research assistant in the thepopebot codebase that will automatically generate financial market reports every weekday morning at 6 AM Pacific.

**Tasks:**

1. **Create directory structure:**
   - Create `operating_system/research_agent/` directory
   - Create `operating_system/research_agent/templates/` subdirectory

2. **Create FINANCIAL_RESEARCH_AGENT.md:**
   - Define the financial research agent's identity as a financial research specialist
   - Include instructions for gathering current market data using Brave Search
   - Specify report format requirements and analysis focus areas
   - Include guidelines for data sources (financial news, market indices, economic indicators)
   - Emphasize current/real-time data gathering and professional analysis

3. **Create financial_template.md:**
   - Design a structured template with consistent sections:
     - Market Overview
     - Key Market Movers  
     - Economic Indicators
     - News Highlights
     - Outlook/Analysis
   - Include formatting guidelines for readability

4. **Create initial financialreport.md:**
   - Create the target file that will be updated daily
   - Include placeholder content or initial report structure

5. **Update CRONS.json:**
   - Add new cron job entry:
     - Name: "morning_financial_research"
     - Schedule: "0 13 * * 1-5" (6 AM Pacific, weekdays only)
     - Type: "agent"
     - Job: "Read operating_system/research_agent/FINANCIAL_RESEARCH_AGENT.md and generate today's financial market report. Update the file at operating_system/research_agent/financialreport.md with current market data, analysis, and insights using Brave Search."
     - Enabled: true

The system should leverage the existing Brave Search skill for real-time data gathering and create a self-updating financial briefing system that runs autonomously every weekday morning.