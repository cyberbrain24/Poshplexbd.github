import logging
from decimal import Decimal
from django.utils import timezone
import datetime
from django.db.models import Sum
from apps.marketing.models import AutomationRule, Campaign, PerformanceSnapshot, MetaAdAccount
from apps.marketing.services.meta_client import MetaAPIClient

logger = logging.getLogger(__name__)

def evaluate_rules() -> list:
    """
    Evaluates all active AutomationRules against the latest PerformanceSnapshot for each campaign.
    Enforces:
      1. Global Daily Spend Cap per Ad Account (auto-pauses all campaigns if spend >= cap)
      2. Fast low ROAS auto-pause (spend > 500 BDT & ROAS < 1.0 pauses immediately)
      3. 24-hour scale guard cooldown and max_budget_cap ceiling
    """
    now = timezone.now()
    today = now.date()
    executions = []

    # ========================================================================
    # 1. Global Daily Spend Cap Check (Account Level Burn Protection)
    # ========================================================================
    capped_accounts = MetaAdAccount.objects.filter(is_active=True, daily_spend_cap__gt=Decimal('0.00'))
    for acc in capped_accounts:
        today_spend = PerformanceSnapshot.objects.filter(
            campaign__ad_account=acc,
            snapshot_time__date=today
        ).aggregate(s=Sum('spend'))['s'] or Decimal('0.00')

        if today_spend >= acc.daily_spend_cap:
            active_camps = Campaign.objects.filter(ad_account=acc, status='ACTIVE')
            token = acc.get_access_token()
            client = MetaAPIClient(token, account_id=acc.meta_account_id)
            for c in active_camps:
                if c.meta_campaign_id:
                    try:
                        client.post(c.meta_campaign_id, json_data={"status": "PAUSED"})
                    except Exception:
                        pass
                c.status = 'PAUSED'
                c.last_error = f"AUTO-PAUSED: Account daily spend cap ({acc.daily_spend_cap}) reached today ({today_spend})."
                c.save(update_fields=['status', 'last_error', 'updated_at'])
                executions.append({
                    "rule": "GLOBAL_DAILY_SPEND_CAP",
                    "campaign": c.name,
                    "action": "PAUSE",
                    "result": f"Account spend ({today_spend}) reached daily cap ({acc.daily_spend_cap})"
                })
            logger.error(
                f"[BURN PROTECTION ALERT] Ad Account '{acc.name}' reached daily spend cap: {today_spend} >= {acc.daily_spend_cap}. "
                f"Auto-paused {active_camps.count()} campaign(s)."
            )

    # ========================================================================
    # 2. Automation Rules & Fast Underperformance Check
    # ========================================================================
    rules = AutomationRule.objects.filter(is_active=True).select_related('campaign')

    for rule in rules:
        if rule.campaign:
            campaigns = [rule.campaign] if rule.campaign.status == 'ACTIVE' else []
        else:
            campaigns = list(Campaign.objects.filter(status='ACTIVE'))

        for campaign in campaigns:
            # Scale Guard: Scale actions (SCALE_UP_20) enforce strict 24-hour cooldown
            cooldown_hrs = 24 if rule.action == 'SCALE_UP_20' else rule.cooldown_hours
            if rule.last_triggered_at:
                cooldown_delta = datetime.timedelta(hours=cooldown_hrs)
                if now < (rule.last_triggered_at + cooldown_delta):
                    continue

            latest_snapshot = PerformanceSnapshot.objects.filter(campaign=campaign).order_by('-snapshot_time').first()
            if not latest_snapshot:
                continue

            triggered = False
            condition = rule.condition_type
            thresh = rule.threshold_value

            # Fast Low-ROAS Burn Protection: If spend > $5 USD (or 500 BDT) and ROAS < 1.0 -> Auto-Pause Faster
            burn_threshold = Decimal('5.00') if (campaign.ad_account.currency or 'USD').upper() == 'USD' else Decimal('500.00')
            if latest_snapshot.spend > burn_threshold and Decimal(str(latest_snapshot.roas)) < Decimal('1.00'):
                if rule.action == 'PAUSE':
                    triggered = True

            min_spend = Decimal('5.00') if (campaign.ad_account.currency or 'USD').upper() == 'USD' else Decimal('100.00')
            if condition == 'ROAS_BELOW' and latest_snapshot.spend > min_spend:
                if Decimal(str(latest_snapshot.roas)) < thresh:
                    triggered = True

            elif condition == 'ROAS_ABOVE' and latest_snapshot.spend > min_spend:
                if Decimal(str(latest_snapshot.roas)) > thresh:
                    triggered = True

            elif condition == 'SPEND_ABOVE':
                if latest_snapshot.spend > thresh:
                    triggered = True

            elif condition == 'CPC_ABOVE' and latest_snapshot.clicks > 10:
                if latest_snapshot.cpc > thresh:
                    triggered = True

            if triggered:
                action_result = _execute_action(rule, campaign, latest_snapshot)
                rule.last_triggered_at = now
                log_entry = f"[{now.strftime('%Y-%m-%d %H:%M:%S')}] Triggered for '{campaign.name}': {action_result}\n"
                rule.last_trigger_log = (log_entry + (rule.last_trigger_log or ''))[:2000]
                rule.save(update_fields=['last_triggered_at', 'last_trigger_log', 'updated_at'])
                executions.append({"rule": rule.name, "campaign": campaign.name, "action": rule.action, "result": action_result})

    return executions

def _execute_action(rule: AutomationRule, campaign: Campaign, snapshot: PerformanceSnapshot) -> str:
    token = campaign.ad_account.get_access_token()
    client = MetaAPIClient(token)

    if rule.action == 'PAUSE':
        if campaign.meta_campaign_id:
            client.post(f"{campaign.meta_campaign_id}", json_data={"status": "PAUSED"})
        campaign.status = 'PAUSED'
        campaign.save(update_fields=['status', 'updated_at'])
        msg = f"Paused campaign due to condition {rule.condition_type} (value: {rule.threshold_value})"
        logger.info(f"Rule '{rule.name}' -> {msg}")
        return msg

    elif rule.action == 'SCALE_UP_20':
        old_budget = campaign.budget_amount
        # Hard safety ceiling: max_budget_cap if > 0 else 3x initial budget_amount
        cap = campaign.max_budget_cap if (campaign.max_budget_cap and campaign.max_budget_cap > Decimal('0.00')) else (old_budget * Decimal('3.00'))
        
        if old_budget >= cap:
            msg = f"SCALE_UP_20 blocked: current budget ({old_budget}) has reached or exceeded max safety cap ({cap})"
            logger.warning(f"Rule '{rule.name}' -> {msg}")
            return msg

        proposed_budget = round(old_budget * Decimal('1.20'), 2)
        new_budget = min(proposed_budget, cap)

        campaign.budget_amount = new_budget
        campaign.save(update_fields=['budget_amount', 'updated_at'])

        # Update Meta AdSets daily budget
        for adset in campaign.adsets.all():
            if adset.meta_adset_id:
                client.post(f"{adset.meta_adset_id}", json_data={"daily_budget": int(new_budget * 100)})
                adset.daily_budget = new_budget
                adset.save(update_fields=['daily_budget', 'updated_at'])

        currency = campaign.ad_account.currency or 'USD'
        msg = f"Scaled budget +20%: {currency} {old_budget} -> {currency} {new_budget} (Cap: {currency} {cap})"
        logger.info(f"Rule '{rule.name}' -> {msg}")
        return msg

    elif rule.action == 'SCALE_DOWN_20':
        old_budget = campaign.budget_amount
        currency = campaign.ad_account.currency or 'USD'
        min_allowed = Decimal('5.00') if currency == 'USD' else Decimal('100.00')
        new_budget = max(min_allowed, round(old_budget * Decimal('0.80'), 2))
        campaign.budget_amount = new_budget
        campaign.save(update_fields=['budget_amount', 'updated_at'])

        for adset in campaign.adsets.all():
            if adset.meta_adset_id:
                client.post(f"{adset.meta_adset_id}", json_data={"daily_budget": int(new_budget * 100)})
                adset.daily_budget = new_budget
                adset.save(update_fields=['daily_budget', 'updated_at'])

        msg = f"Scaled budget -20%: {currency} {old_budget} -> {currency} {new_budget}"
        logger.info(f"Rule '{rule.name}' -> {msg}")
        return msg

    elif rule.action == 'NOTIFY':
        currency = campaign.ad_account.currency or 'USD'
        msg = f"Notification alert: condition {rule.condition_type} met (current ROAS: {snapshot.roas}x, spend: {currency} {snapshot.spend})"
        logger.info(f"Rule '{rule.name}' -> {msg}")
        return msg

    return "No action taken"
