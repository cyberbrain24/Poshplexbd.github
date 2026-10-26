import logging
from decimal import Decimal
from django.utils import timezone
import datetime
from celery import shared_task
from apps.marketing.models import MetaAdAccount, Campaign, PerformanceSnapshot
from apps.marketing.services.meta_insights import fetch_insights
from apps.marketing.services.attribution import calculate_campaign_attributed_revenue
from apps.marketing.services.rules_engine import evaluate_rules
from apps.marketing.services.meta_client import MetaAPIClient

logger = logging.getLogger(__name__)

@shared_task(name='apps.marketing.tasks.poll_performance_metrics')
def poll_performance_metrics():
    """
    Runs every 1 hour via Celery Beat.
    Fetches Meta Graph API insights for all active ad accounts, computes attributed
    order revenue, and creates PerformanceSnapshot records.
    """
    now = timezone.now()
    since_date = (now - datetime.timedelta(days=1)).strftime('%Y-%m-%d')
    until_date = now.strftime('%Y-%m-%d')
    snapshots_created = 0

    accounts = MetaAdAccount.objects.filter(is_active=True)
    for account in accounts:
        try:
            insights = fetch_insights(account, since=since_date, until=until_date)
            for item in insights:
                meta_cid = item.get("meta_campaign_id")
                if not meta_cid:
                    continue

                campaign = Campaign.objects.filter(meta_campaign_id=meta_cid).first()
                if not campaign:
                    continue

                spend = item.get("spend", Decimal('0.00'))
                impressions = item.get("impressions", 0)
                clicks = item.get("clicks", 0)
                conversions = item.get("conversions", 0)

                # Compute order revenue attributed to this campaign in the window
                since_dt = now - datetime.timedelta(days=1)
                attributed_rev = calculate_campaign_attributed_revenue(campaign, since=since_dt, until=now)

                # Create snapshot
                PerformanceSnapshot.objects.create(
                    campaign=campaign,
                    snapshot_time=now,
                    spend=spend,
                    impressions=impressions,
                    reach=item.get("reach", 0),
                    frequency=item.get("frequency", 1.0),
                    cpm=item.get("cpm", Decimal('0.00')),
                    clicks=clicks,
                    link_clicks=item.get("link_clicks", 0),
                    cost_per_link_click=item.get("cost_per_link_click", Decimal('0.00')),
                    conversions=conversions,
                    cost_per_result=item.get("cost_per_result", Decimal('0.00')),
                    shop_clicks=item.get("shop_clicks", 0),
                    landing_page_views=item.get("landing_page_views", 0),
                    cost_per_landing_page=item.get("cost_per_landing_page", Decimal('0.00')),
                    revenue_attributed=attributed_rev,
                )
                snapshots_created += 1

            account.last_synced_at = now
            account.save(update_fields=['last_synced_at'])

        except Exception as e:
            logger.error(f"Error polling performance metrics for AdAccount #{account.id}: {e}", exc_info=True)

    logger.info(f"poll_performance_metrics completed. Created {snapshots_created} snapshot(s).")
    return snapshots_created


@shared_task(name='apps.marketing.tasks.evaluate_automation_rules')
def evaluate_automation_rules_task():
    """
    Runs every 30 minutes via Celery Beat.
    Evaluates ROAS, spend, and CPC rules against latest campaign snapshots.
    """
    try:
        results = evaluate_rules()
        logger.info(f"evaluate_automation_rules_task completed. Executed {len(results)} actions: {results}")
        return results
    except Exception as e:
        logger.error(f"Error executing automation rules task: {e}", exc_info=True)
        return []


@shared_task(name='apps.marketing.tasks.sync_campaign_status')
def sync_campaign_status():
    """
    Runs every 15 minutes via Celery Beat.
    Syncs the remote status (ACTIVE, PAUSED, ARCHIVED) from Meta Graph API to the local database.
    """
    campaigns = Campaign.objects.filter(meta_campaign_id__isnull=False).exclude(status__in=['DRAFT', 'ARCHIVED'])
    updated_count = 0

    for campaign in campaigns:
        try:
            token = campaign.ad_account.get_access_token()
            client = MetaAPIClient(token)
            res = client.get(f"{campaign.meta_campaign_id}", params={"fields": "status,effective_status"})
            remote_status = res.get("effective_status") or res.get("status")

            if remote_status:
                status_map = {
                    "ACTIVE": "ACTIVE",
                    "PAUSED": "PAUSED",
                    "ARCHIVED": "ARCHIVED",
                    "DELETED": "ARCHIVED",
                    "DISAPPROVED": "ERROR",
                }
                new_status = status_map.get(remote_status.upper())
                if new_status and new_status != campaign.status:
                    logger.info(f"Syncing campaign #{campaign.id} status: {campaign.status} -> {new_status}")
                    campaign.status = new_status
                    campaign.save(update_fields=['status', 'updated_at'])
                    updated_count += 1

        except Exception as e:
            logger.warning(f"Could not sync status for Campaign #{campaign.id}: {e}")

    logger.info(f"sync_campaign_status completed. Updated {updated_count} campaign(s).")
    return updated_count


@shared_task(name='apps.marketing.tasks.refresh_expiring_tokens')
def refresh_expiring_tokens():
    """
    Runs daily at 02:00 AM via Celery Beat.
    Finds MetaAdAccount records where token_expires_at is within the next 7 days,
    refreshes the long-lived token via Meta Graph API, and updates expiration.
    If refresh fails, sets is_active=False and logs critical warning for admin notification.
    """
    from apps.marketing.services.meta_auth import refresh_long_lived_token
    now = timezone.now()
    threshold = now + datetime.timedelta(days=7)
    expiring_accounts = MetaAdAccount.objects.filter(
        is_active=True,
        token_expires_at__isnull=False,
        token_expires_at__lt=threshold
    )
    refreshed_count = 0
    failed_count = 0

    for account in expiring_accounts:
        try:
            curr_token = account.get_access_token()
            new_token, new_expiry = refresh_long_lived_token(curr_token)
            account.set_access_token(new_token)
            account.token_expires_at = new_expiry
            account.save(update_fields=['access_token_encrypted', 'token_expires_at', 'updated_at'])
            refreshed_count += 1
            logger.info(f"Successfully refreshed Meta token for account #{account.id} ({account.name}). New expiry: {new_expiry}")
        except Exception as e:
            failed_count += 1
            account.is_active = False
            account.save(update_fields=['is_active', 'updated_at'])
            logger.error(
                f"[ADMIN ALERT] Failed to refresh expiring token for MetaAdAccount #{account.id} ({account.name}): {e}. "
                f"Account marked inactive to avoid cascading API auth failures."
            )

    logger.info(f"refresh_expiring_tokens finished. Refreshed: {refreshed_count}, Failed: {failed_count}.")
    return {"refreshed": refreshed_count, "failed": failed_count}


@shared_task(name='apps.marketing.tasks.reset_ai_quota')
def reset_ai_quota():
    """
    Runs daily at midnight (00:00) Asia/Dhaka via Celery Beat.
    Resets used_today to 0 for all AIGenerationQuota records.
    """
    from apps.marketing.models import AIGenerationQuota
    import zoneinfo
    dhaka_tz = zoneinfo.ZoneInfo("Asia/Dhaka")
    today_dhaka = timezone.now().astimezone(dhaka_tz).date()

    count = AIGenerationQuota.objects.update(used_today=0, reset_date=today_dhaka)
    logger.info(f"reset_ai_quota completed: Reset daily limit for {count} users on {today_dhaka}.")
    return count


@shared_task(name='apps.marketing.tasks.run_meta_agent_cycle')
def run_meta_agent_cycle():
    """
    Runs every 6 hours (00:00, 06:00, 12:00, 18:00 Asia/Dhaka) via Celery Beat.
    Executes autonomous perception, research, reasoning, action, learning, and reporting.
    """
    from apps.marketing.agent.brain import MetaAgent
    agent = MetaAgent()
    result = agent.run_cycle()
    logger.info(f"Celery run_meta_agent_cycle completed: {result.get('status')}")
    return result



