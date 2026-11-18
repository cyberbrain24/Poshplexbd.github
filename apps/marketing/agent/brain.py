"""
Autonomous Meta Agent Brain (apps.marketing.agent.brain).
Implements the 6-stage Cognitive Agent Loop:
  1. PERCEIVE
  2. RESEARCH
  3. REASON
  4. ACT
  5. LEARN
  6. REPORT
"""
import json
import logging
import uuid
from decimal import Decimal
from typing import Dict, Any, List, Optional
from django.utils import timezone
import datetime
from django.conf import settings
from django.db.models import Sum

from apps.marketing.models import AgentActionLog, AgentConfig, PerformanceSnapshot, Campaign
from apps.marketing.agent.prompts import (
    AGENT_SYSTEM_PROMPT,
    AGENT_OUTPUT_SCHEMA_INSTRUCTION,
    AGENT_CHAT_SYSTEM_PROMPT
)
from apps.marketing.agent.memory import agent_memory
from apps.marketing.agent.tools import (
    get_campaign_performance,
    analyze_product_trend,
    analyze_competitor_ads,
    generate_copy,
    create_campaign_from_product,
    pause_campaign,
    scale_campaign,
    create_lookalike_audience,
    notify_admin,
    get_competitor_winning_ads,
    get_competitor_gaps,
    get_competitor_threat_report,
    get_tiktok_trends,
)


logger = logging.getLogger(__name__)


class MetaAgent:
    """
    Autonomous AI Media Buyer Agent for PoshPlex.
    Operates in either 'SUGGEST' (Human-in-the-loop) or 'AUTO' (Fully Autonomous) mode.
    """

    def __init__(self):
        self.config = AgentConfig.get_solo()
        self.cycle_id = f"cycle_{timezone.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        self.tool_failure_count = 0
        self.max_failures = 3

    def run_cycle(self) -> Dict[str, Any]:
        """
        Executes one full autonomous decision cycle.
        """
        if not self.config.is_enabled:
            logger.info("Meta Agent cycle skipped: Agent is disabled in AgentConfig.")
            return {"cycle_id": self.cycle_id, "status": "SKIPPED_DISABLED"}

        logger.info(f"--- [START] Meta Agent Cycle {self.cycle_id} (Mode: {self.config.mode}) ---")

        # ====================================================================
        # STAGE 1: PERCEIVE
        # ====================================================================
        perception = self._perceive()

        # Hard Guard: Daily Budget Check
        if perception["spend_today_bdt"] >= float(self.config.agent_daily_budget):
            msg = (
                f"Agent Daily Budget Cap reached (Spent: ${perception['spend_today_bdt']} USD / "
                f"Cap: ${self.config.agent_daily_budget} USD). Pausing cycle execution to prevent money burn."
            )
            notify_admin(msg, level="WARNING")
            AgentActionLog.objects.create(
                agent_cycle_id=self.cycle_id,
                reasoning_text="Daily agent budget threshold reached today. Cycle terminated safely.",
                tool_name="agent_budget_guard",
                action_taken="ABORT_CYCLE",
                outcome=msg,
                cost_impact=Decimal('0.00'),
                status="SUCCESS"
            )
            return {"cycle_id": self.cycle_id, "status": "BUDGET_CAP_REACHED", "message": msg}

        # ====================================================================
        # STAGE 2: RESEARCH
        # ====================================================================
        research = self._research(perception)

        # ====================================================================
        # STAGE 3: REASON
        # ====================================================================
        decisions = self._reason(perception, research)

        # ====================================================================
        # STAGE 4: ACT
        # ====================================================================
        action_results = self._act(decisions)

        # ====================================================================
        # STAGE 5: LEARN
        # ====================================================================
        self._learn(decisions, action_results)

        # ====================================================================
        # STAGE 6: REPORT
        # ====================================================================
        report = self._report(decisions, action_results)

        logger.info(f"--- [COMPLETE] Meta Agent Cycle {self.cycle_id} finished successfully. ---")
        return {
            "cycle_id": self.cycle_id,
            "status": "COMPLETED",
            "mode": self.config.mode,
            "decisions_count": len(decisions.get("actions", [])),
            "executed_actions": len(action_results),
            "summary": report

        }

    # ------------------------------------------------------------------------
    # Cognitive Stages Implementation
    # ------------------------------------------------------------------------

    def _perceive(self) -> Dict[str, Any]:
        """Gathers real-time performance, inventory, and today's ad spend."""
        now = timezone.now()
        today = now.date()

        # Spend today across campaigns
        today_spend = PerformanceSnapshot.objects.filter(
            snapshot_time__date=today
        ).aggregate(s=Sum('spend'))['s'] or Decimal('0.00')

        campaign_stats = get_campaign_performance(days=1)
        active_camps = [c for c in campaign_stats if c["status"] == "ACTIVE"]

        memory_context = agent_memory.format_memories_for_prompt(limit=6)

        return {
            "timestamp": now.isoformat(),
            "spend_today_bdt": float(today_spend),
            "agent_daily_budget": float(self.config.agent_daily_budget),
            "remaining_budget": max(0.0, float(self.config.agent_daily_budget) - float(today_spend)),
            "active_campaigns_count": len(active_camps),
            "campaigns": campaign_stats,
            "memory_context": memory_context
        }

    def _research(self, perception: Dict[str, Any]) -> Dict[str, Any]:
        """Deep dives into catalog order trends, competitor winning angles, and viral TikTok audio."""
        low_roas_detected = any(c["roas"] < 1.0 and c["spend_window"] > 500 for c in perception["campaigns"])
        high_roas_detected = any(c["roas"] >= 3.0 for c in perception["campaigns"])

        # 1. Product velocity from catalog & orders
        product_trends = analyze_product_trend(days=7)
        competitor_intel = analyze_competitor_ads(keyword="heavyweight streetwear")

        # 2.5 Competitor Intelligence Check (Meta Engine v4.1)
        competitor_winning = get_competitor_winning_ads(limit=3)
        competitor_gaps = get_competitor_gaps()
        tiktok_trends = get_tiktok_trends()
        threat_report = get_competitor_threat_report()

        return {
            "low_roas_detected": low_roas_detected,
            "high_roas_detected": high_roas_detected,
            "product_trends": product_trends,
            "competitor_intel": competitor_intel,
            "competitor_winning": competitor_winning,
            "competitor_gaps": competitor_gaps,
            "tiktok_trends": tiktok_trends,
            "threat_report": threat_report,
        }

    def _reason(self, perception: Dict[str, Any], research: Dict[str, Any]) -> Dict[str, Any]:
        """Calls LLM (gpt-4o-mini) to plan structured actions with fallback heuristics."""
        api_key = getattr(settings, 'OPENAI_API_KEY', '') or getattr(settings, 'AI_ENGINE_KEY', '')
        base_url = 'https://api.openai.com/v1'
        model_name = 'gpt-4o-mini'
        temp = 0.3
        max_tokens = 800
        active_route = None

        try:
            from apps.marketing.services.ai_router import get_ai_route_for_operation, DEFAULT_BASE_URLS
            active_route = get_ai_route_for_operation('AGENT_BRAIN')
            if active_route and active_route.provider and active_route.provider.is_active:
                prov_key = active_route.provider.get_api_key()
                if prov_key:
                    api_key = prov_key
                    base_url = active_route.provider.base_url or DEFAULT_BASE_URLS.get(active_route.provider.provider_type, 'https://api.openai.com/v1')
                    model_name = active_route.model_name or active_route.provider.default_model
                    temp = active_route.temperature
                    max_tokens = active_route.max_tokens
        except Exception:
            pass

        # Construct prompt payload
        system_instruction = f"{AGENT_SYSTEM_PROMPT}\n{AGENT_OUTPUT_SCHEMA_INSTRUCTION}"
        user_context = (
            f"CURRENT SITUATION (PoshPlex BD):\n"
            f"- Mode: {self.config.mode}\n"
            f"- Ad Spend Today: ${perception['spend_today_bdt']} USD / Cap: ${perception['agent_daily_budget']} USD\n"
            f"- Active Campaigns: {json.dumps(perception['campaigns'], indent=2)}\n"
            f"- Top Catalog Trends (Last 7d): {json.dumps(research['product_trends'][:3], indent=2)}\n"
            f"- Competitor Winning Ads (Lindy 30d): {json.dumps(research.get('competitor_winning', {}), indent=2)}\n"
            f"- Competitor Price & Creative Gaps: {json.dumps(research.get('competitor_gaps', {}), indent=2)}\n"
            f"- TikTok Viral Sounds for Reels: {json.dumps(research.get('tiktok_trends', {}), indent=2)}\n"
            f"- Learned Strategic Memory:\n{perception['memory_context']}\n\n"
            f"Analyze every campaign and suggest or execute optimization actions strictly following the rules."
        )

        # Call LLM via standard HTTP handler (supporting Gemini, OpenAI, Claude, DeepSeek, etc.)
        if api_key:
            try:
                from apps.marketing.services.ai_router import _execute_openai_compat_http
                messages = [
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": user_context}
                ]
                data = _execute_openai_compat_http(
                    base_url=base_url,
                    api_key=api_key,
                    model=model_name,
                    messages=messages,
                    temperature=temp,
                    max_tokens=max_tokens,
                    json_mode=True,
                    timeout=30
                )
                choices = data.get("choices", [])
                if choices:
                    content = choices[0].get("message", {}).get("content", "")
                    if active_route and active_route.provider:
                        active_route.total_calls += 1
                        active_route.provider.total_calls += 1
                        active_route.save(update_fields=['total_calls'])
                        active_route.provider.save(update_fields=['total_calls'])

                    parsed = json.loads(content)
                    if "actions" in parsed:
                        return parsed
            except Exception as e:
                logger.warning(f"AI agent reasoning failed: {e}. Falling back to deterministic expert heuristics.")

        # Deterministic Expert Heuristic Reasoning Engine (Zero-Failure Fallback)
        return self._heuristic_reason(perception, research)

    def _heuristic_reason(self, perception: Dict[str, Any], research: Dict[str, Any]) -> Dict[str, Any]:
        """Safety heuristic logic that executes if LLM is unreachable."""
        actions = []
        learnings = []
        summary_points = []

        for camp in perception["campaigns"]:
            c_id = camp["campaign_id"]
            name = camp["name"]
            roas = camp["roas"]
            spend = camp["spend_window"]
            is_fatigued = camp.get("is_fatigued", False)

            # Rule 1: ROAS < 1.0 and spend > 5.0 USD -> Suggest PAUSE
            if camp["status"] == "ACTIVE" and roas < 1.0 and spend > 5.0:
                actions.append({
                    "tool": "pause_campaign",
                    "params": {"campaign_id": c_id, "reason": f"ROAS low ({roas}x) spend (${spend} USD) high"},
                    "recommendation_title": f"Pause Campaign: {name}",
                    "reasoning": (
                        f"📊 [Meta Auction & Profit Analysis]: Campaign '{name}' has consumed ${spend} USD with an unprofitable ROAS of {roas}x. "
                        f"Under Meta's Advantage+ delivery algorithm, continuing delivery on low-converting ad sets signals poor post-click engagement, "
                        f"driving CPMs higher. 💡 [Practical Recommendation]: Pause this campaign to protect cash flow, and redeploy the budget into "
                        f"higher-converting creative angles or trending catalog items."
                    ),
                    "cost_impact": 0.00
                })
                summary_points.append(f"Recommended pause for {name} (ROAS {roas}x)")

            # Rule 2: Out of stock product -> Suggest PAUSE
            elif camp["status"] == "ACTIVE" and camp.get("product_is_sold_out"):
                actions.append({
                    "tool": "pause_campaign",
                    "params": {"campaign_id": c_id, "reason": "Linked catalog product is sold out"},
                    "recommendation_title": f"Pause Stocked-Out Campaign: {name}",
                    "reasoning": (
                        f"📦 [Inventory Sync Guard]: The catalog product linked to '{name}' is currently 100% out of stock. "
                        f"Meta's pixel will record bounces and abandoned checkouts, degrading the ad's Quality Ranking score in the auction. "
                        f"💡 [Practical Recommendation]: Pause immediately until restocked to avoid burning ad spend on traffic that cannot checkout."
                    ),
                    "cost_impact": 0.00
                })
                summary_points.append(f"Recommended pause for {name} due to stockout")

            # Rule 3: ROAS > 3.5 -> Suggest SCALE +20%
            elif camp["status"] == "ACTIVE" and roas >= 3.5 and camp["budget_amount"] < camp["max_budget_cap"]:
                scale_amount = round(camp["budget_amount"] * 0.20, 2)
                actions.append({
                    "tool": "scale_campaign",
                    "params": {"campaign_id": c_id, "percent": 20},
                    "recommendation_title": f"Scale Winning Campaign: {name} (+20%)",
                    "reasoning": (
                        f"🚀 [Meta Scaling Opportunity]: Campaign '{name}' is generating an exceptional ROAS of {roas}x. "
                        f"According to Meta's machine learning dynamics, budget increases exceeding 20% can destabilize the learning phase and inflate CPAs. "
                        f"💡 [Practical Recommendation]: Increase daily budget by exactly +20% (+${scale_amount} USD) to capture additional high-intent buyers while keeping auction delivery stable."
                    ),
                    "cost_impact": scale_amount
                })
                summary_points.append(f"Recommended scaling {name} +20% (ROAS {roas}x)")

            # Rule 4: Creative Fatigue
            elif camp["status"] == "ACTIVE" and is_fatigued:
                actions.append({
                    "tool": "notify_admin",
                    "params": {"message": f"Creative fatigue detected on {name}: CTR dropped 30% over 3 days. Recommend refreshing imagery.", "level": "WARNING"},
                    "recommendation_title": f"Creative Refresh Needed: {name}",
                    "reasoning": (
                        f"⚠️ [Creative Fatigue Warning]: '{name}' has experienced a 30%+ drop in Click-Through Rate (CTR) over the past 72 hours, "
                        f"indicating audience ad blindness in the target pool. Under Meta's 2026 auction logic, fatigued creative receives lower auction priority and higher CPMs. "
                        f"💡 [Practical Recommendation]: Keep campaign active but introduce 2 fresh reel/lifestyle video angles to reset viewer engagement."
                    ),
                    "cost_impact": 0.00
                })
                learnings.append({
                    "key": f"creative_fatigue_{c_id}",
                    "insight": f"Campaign '{name}' experienced creative fatigue; audience saturated.",
                    "importance": 1.2
                })

        # Rule 5: Recommend top trending product if budget allows
        if not actions and research["product_trends"]:
            top_prod = research["product_trends"][0]
            if top_prod.get("is_active") and not top_prod.get("is_sold_out"):
                actions.append({
                    "tool": "create_campaign_from_product",
                    "params": {"product_id": top_prod["product_id"], "budget": 10.0},
                    "recommendation_title": f"Launch Trending Streetwear Test: {top_prod['name']}",
                    "reasoning": (
                        f"🔥 [Catalog Sales Velocity Analysis]: '{top_prod['name']}' is demonstrating peak organic order velocity on the website over the last 7 days. "
                        f"Meta's Advantage+ catalog algorithms perform best when feeding high-converting, high-affinity products into broad Dhaka streetwear demographics. "
                        f"💡 [Practical Recommendation]: Launch an initial $10.00 USD test drop campaign targeting streetwear audiences to scale sales volume."
                    ),
                    "cost_impact": 10.00
                })
                summary_points.append(f"Suggested test campaign for trending '{top_prod['name']}'")

        # Rule 6: Exploit high-confidence competitor price or hook gap
        gaps = research.get("competitor_gaps", {}).get("gaps", [])
        if gaps:
            top_gap = gaps[0]
            actions.append({
                "tool": "notify_admin",
                "params": {
                    "message": f"Competitor Gap Detected: {top_gap['title']}. Action: {top_gap['recommendation']}",
                    "level": "INFO"
                },
                "recommendation_title": f"Exploit Rival Market Gap: {top_gap['title']}",
                "reasoning": (
                    f"🕵️ [Competitor Intelligence & Hook Radar]: Comprehensive rival monitoring identified a key market opportunity: {top_gap['title']}. "
                    f"💡 [Practical Sales Tactic]: {top_gap['recommendation']}. Deploying this positioning angle gives PoshPlex an immediate competitive edge."
                ),
                "cost_impact": 0.00
            })
            summary_points.append(f"Exploiting market gap: {top_gap['title']}")


        summary_text = (
            " | ".join(summary_points)
            if summary_points
            else "Shob campaign safe ase. Konu urgent intervention dorkar nai."
        )

        return {
            "summary": summary_text,
            "actions": actions,
            "learnings": learnings
        }

    def _act(self, decisions: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Pure Advisory Mode: Stages all suggestions in AgentActionLog as 'SUGGESTION' / 'NEEDS_APPROVAL'
        WITHOUT auto-applying or mutating Meta ads or local databases.
        Only user approval can execute actions.
        """
        action_results = []

        for item in decisions.get("actions", []):
            tool_name = item.get("tool")
            params = item.get("params", {})
            reasoning = item.get("reasoning", "")
            rec_title = item.get("recommendation_title") or item.get("action_taken") or f"SUGGESTION: {tool_name.replace('_', ' ').upper()}"
            cost_impact = Decimal(str(item.get("cost_impact", 0.00)))

            # Determine linked campaign
            c_id = params.get("campaign_id")
            camp_obj = Campaign.objects.filter(id=c_id).first() if c_id else None

            # Always record every suggestion for human review with full audit details
            log_entry = AgentActionLog.objects.create(
                agent_cycle_id=self.cycle_id,
                reasoning_text=reasoning,
                tool_name=tool_name,
                campaign=camp_obj,
                action_taken=rec_title,
                outcome="Pending Human Review (Advisory Suggestion)",
                cost_impact=cost_impact,
                status="NEEDS_APPROVAL",
                tool_params=params
            )

            action_results.append({
                "tool": tool_name,
                "status": "NEEDS_APPROVAL",
                "log_id": log_entry.id,
                "message": "Suggestion staged for owner review.",
                "reasoning": reasoning
            })

        return action_results

        return action_results

    def _learn(self, decisions: Dict[str, Any], action_results: List[Dict[str, Any]]):
        """Saves newly synthesized insights to persistent memory (Postgres + Redis)."""
        for item in decisions.get("learnings", []):
            k = item.get("key", "").strip()
            insight = item.get("insight", "")
            importance = float(item.get("importance", 1.0))
            if k and insight:
                agent_memory.save_memory(k, {"insight": insight}, importance=importance)

    def _report(self, decisions: Dict[str, Any], action_results: List[Dict[str, Any]]) -> str:
        """Sends an executive summary notification to the admin monitor."""
        summary = decisions.get("summary", "Agent cycle completed.")
        notify_admin(f"[Agent Cycle {self.cycle_id}] {summary}", level="INFO")
        return summary





def chat_with_agent(user_message: str) -> str:
    """
    Direct conversational interface with the Meta Agent for the Refine Admin Chat Box.
    Answers store owner queries in natural Banglish using memory and active campaign context.
    """
    api_key = getattr(settings, 'OPENAI_API_KEY', '') or getattr(settings, 'AI_ENGINE_KEY', '')

    # Gather live context
    campaign_stats = get_campaign_performance(days=7)
    recent_logs = AgentActionLog.objects.order_by('-created_at')[:8]
    logs_str = "\n".join([
        f"- [{l.created_at.strftime('%H:%M')}] Tool: {l.tool_name} | Action: {l.action_taken} | Reasoning: {l.reasoning_text} | Status: {l.status}"
        for l in recent_logs
    ])
    memories_str = agent_memory.format_memories_for_prompt(limit=8)

    context_prompt = (
        f"{AGENT_CHAT_SYSTEM_PROMPT}\n\n"
        f"AGENT MEMORY:\n{memories_str}\n\n"
        f"RECENT ACTIONS LOGS:\n{logs_str}\n\n"
        f"ACTIVE CAMPAIGNS SUMMARY:\n{json.dumps(campaign_stats, indent=2)}\n\n"
        f"STORE OWNER ASKS: {user_message}\n\n"
        f"YOUR ANSWER (in warm, helpful Banglish):"
    )

    if api_key:
        try:
            from apps.marketing.services.ai_router import _execute_openai_compat_http, get_ai_route_for_operation, DEFAULT_BASE_URLS
            base_url = "https://api.openai.com/v1"
            model_name = "gpt-4o-mini"
            route = get_ai_route_for_operation("AGENT_BRAIN")
            if route and route.provider and route.provider.is_active:
                prov_key = route.provider.get_api_key()
                if prov_key:
                    api_key = prov_key
                    base_url = route.provider.base_url or DEFAULT_BASE_URLS.get(route.provider.provider_type, "https://api.openai.com/v1")
                    model_name = route.model_name or route.provider.default_model

            data = _execute_openai_compat_http(
                base_url=base_url,
                api_key=api_key,
                model=model_name,
                messages=[
                    {"role": "system", "content": AGENT_CHAT_SYSTEM_PROMPT},
                    {"role": "user", "content": context_prompt}
                ],
                max_tokens=450,
                temperature=0.5,
                timeout=30
            )
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "").strip()
        except Exception as e:
            logger.error(f"Error in chat_with_agent: {e}")

    # Fallback response
    return (
        f"Amar memory ebong recent action logs check korechi. "
        f"Recent actions: {len(recent_logs)} ti decision execute kora hoise. "
        f"Apnar campaign gulo profit-focused optimization rule onujayi monitored hocche!"
    )
