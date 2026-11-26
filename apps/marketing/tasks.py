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
            # 1. Sync remote campaigns for this account if any newly created natively on Meta
            token = account.get_access_token()
            client = MetaAPIClient(token, account_id=account.meta_account_id)
            account_prefix = account.meta_account_id
            if not account_prefix.startswith("act_"):
                account_prefix = f"act_{account_prefix}"

            try:
                camp_res = client.get(
                    f"{account_prefix}/campaigns",
                    params={"fields": "id,name,objective,status,effective_status,daily_budget,lifetime_budget", "limit": 100}
                )
                for mc in camp_res.get("data", []):
                    meta_cid = mc.get("id")
                    if not meta_cid:
                        continue
                    camp_name = mc.get("name") or f"Meta Campaign {meta_cid}"
                    camp_status = (mc.get("effective_status") or mc.get("status") or "ACTIVE").upper()
                    if camp_status not in dict(Campaign.STATUS_CHOICES):
                        camp_status = "ACTIVE"

                    daily_b = mc.get("daily_budget")
                    lifetime_b = mc.get("lifetime_budget")
                    budget_type = "LIFETIME" if lifetime_b else "DAILY"
                    raw_b = lifetime_b or daily_b or 0
                    try:
                        budget_amt = Decimal(str(raw_b)) / Decimal('100.00') if Decimal(str(raw_b)) > Decimal('100.00') else Decimal(str(raw_b))
                    except Exception:
                        budget_amt = Decimal('20.00')

                    Campaign.objects.update_or_create(
                        meta_campaign_id=meta_cid,
                        defaults={
                            "ad_account": account,
                            "name": camp_name,
                            "status": camp_status,
                            "budget_type": budget_type,
                            "budget_amount": budget_amt if budget_amt > 0 else Decimal('20.00'),
                        }
                    )
            except Exception as camp_err:
                logger.warning(f"Could not poll campaign list from Meta for {account_prefix}: {camp_err}")

            # 2. Fetch insights performance snapshots
            insights = fetch_insights(account, since=since_date, until=until_date)
            for item in insights:
                meta_cid = item.get("meta_campaign_id")
                if not meta_cid:
                    continue

                campaign = Campaign.objects.filter(meta_campaign_id=meta_cid).first()
                if not campaign:
                    c_name = item.get("campaign_name") or f"Meta Campaign {meta_cid}"
                    campaign = Campaign.objects.create(
                        ad_account=account,
                        name=c_name,
                        meta_campaign_id=meta_cid,
                        status="ACTIVE",
                        budget_amount=Decimal('20.00'),
                    )

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


# ============================================================================
# CUSTOMER DATA & ATTRIBUTION PLATFORM ASYNC TASKS
# ============================================================================

@shared_task(name='apps.marketing.tasks.process_tracking_event', queue='tracking_queue')
def process_tracking_event(event_data, ip_address=None, user_agent=None):
    """
    Asynchronous intake for first-party tracking events routed to dedicated tracking_queue.
    Enforces validation schema, tracks visitor session, links customer identity,
    and appends to RawTrackingEvent.
    """
    from apps.marketing.services.attribution_engine import record_tracking_event
    try:
        raw_event = record_tracking_event(event_data, ip_address=ip_address, user_agent=user_agent)
        return {"status": "ok", "event_id": raw_event.event_id, "schema_status": raw_event.status}
    except Exception as e:
        logger.error(f"Error processing tracking event: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}


@shared_task(name='apps.marketing.tasks.process_tracking_events_batch', queue='tracking_queue')
def process_tracking_events_batch(events_list):
    """
    Processes a batch of up to 100 queued events from Redis to reduce DB roundtrips.
    """
    from apps.marketing.services.attribution_engine import record_tracking_event
    processed_count = 0
    errors = 0
    for evt in events_list:
        try:
            record_tracking_event(evt.get("data", {}), ip_address=evt.get("ip"), user_agent=evt.get("ua"))
            processed_count += 1
        except Exception:
            errors += 1
    logger.info(f"process_tracking_events_batch finished: {processed_count} processed, {errors} errors.")
    return {"processed": processed_count, "errors": errors}


@shared_task(name='apps.marketing.tasks.cleanup_expired_tracking_events', queue='tracking_queue')
def cleanup_expired_tracking_events():
    """
    Runs weekly via Celery Beat.
    Enforces data retention:
      - 90 days for high-volume telemetry (scroll, time_on_page, page_view).
      - 25 months (750 days) for conversion/order/checkout events.
    """
    from apps.marketing.models import RawTrackingEvent
    now = timezone.now()

    # 1. Purge telemetry older than 90 days
    ninety_days_ago = now - datetime.timedelta(days=90)
    telemetry_deleted, _ = RawTrackingEvent.objects.filter(
        server_timestamp__lt=ninety_days_ago,
        event_name__in=['scroll', 'time_on_page', 'page_view', 'scroll_depth']
    ).delete()

    # 2. Purge conversion events older than 25 months (~750 days)
    twenty_five_months_ago = now - datetime.timedelta(days=750)
    conversions_deleted, _ = RawTrackingEvent.objects.filter(
        server_timestamp__lt=twenty_five_months_ago
    ).delete()

    total_purged = telemetry_deleted + conversions_deleted
    logger.info(f"cleanup_expired_tracking_events completed: Purged {telemetry_deleted} telemetry events (>90d) and {conversions_deleted} old events (>25m).")
    return {"purged_telemetry": telemetry_deleted, "purged_old": conversions_deleted, "total": total_purged}


@shared_task(name='apps.marketing.tasks.rebuild_daily_ad_summaries_task')
def rebuild_daily_ad_summaries_task(target_date_str=None):
    """
    Runs nightly via Celery Beat (e.g. at 23:45 Asia/Dhaka) or on-demand.
    Rebuilds DailyAdPerformanceSummary records with accurate delivery outcomes and net profit.
    """
    from apps.marketing.services.attribution_engine import rebuild_daily_ad_performance_summary
    if target_date_str:
        target_date = datetime.datetime.strptime(target_date_str, "%Y-%m-%d").date()
    else:
        target_date = timezone.now().date()
    
    count = rebuild_daily_ad_performance_summary(target_date=target_date)
    return {"date": str(target_date), "summaries_rebuilt": count}


@shared_task(name='apps.marketing.tasks.send_meta_capi_lifecycle_event_task', queue='tracking_queue')
def send_meta_capi_lifecycle_event_task(order_id: int, event_type: str):
    """
    Dispatches Meta Conversions API lifecycle events (e.g. OrderConfirmed, OrderDelivered).
    Fetches customer identifiers, real occurrence timestamp, and Pixel credentials.
    Enforces the 7-day age guard and logs in MetaCapiLog.
    """
    from apps.orders.models import Order
    from apps.marketing.models import MetaAdAccount, VisitorSession, OrderAttributionTouchpoint
    from apps.marketing.services.meta_client import send_capi_lifecycle_event
    from apps.core.models import SystemSetting

    order = Order.objects.filter(id=order_id).first()
    if not order:
        return {"status": "error", "message": f"Order #{order_id} not found"}

    # Resolve real event occurrence time
    real_event_time = None
    if event_type == "OrderDelivered":
        real_event_time = order.delivered_at or getattr(order.status_history.filter(status='delivered').first(), 'timestamp', None) or order.updated_at
    elif event_type == "OrderConfirmed":
        real_event_time = getattr(order.status_history.filter(status='confirmed').first(), 'timestamp', None) or order.updated_at
    if not real_event_time:
        real_event_time = order.updated_at or timezone.now()

    # Get active Pixel ID and Access Token
    pixel_id = ""
    access_token = ""

    # Check SystemSetting
    pixel_setting = SystemSetting.objects.filter(key="tracking_pixels").first()
    if pixel_setting and isinstance(pixel_setting.value, dict):
        pixel_id = pixel_setting.value.get("fb_pixel") or ""

    # Check MetaAdAccount for token
    account = MetaAdAccount.objects.filter(is_active=True).first()
    if account:
        access_token = account.get_access_token()
        if not pixel_id:
            pixel_id = account.meta_account_id.replace("act_", "")

    if not pixel_id or not access_token:
        logger.info(f"Skipping CAPI dispatch for Order #{order_id}: credentials not fully configured.")
        return {"status": "skipped", "reason": "no_credentials"}

    # Fetch fbc / fbp / client_ip from session touchpoints
    fbc = None
    fbp = None
    client_ip = None
    tp = OrderAttributionTouchpoint.objects.filter(order_id=order_id).select_related('session').first()
    if tp and tp.session:
        fbc = tp.session.fbc or None
        fbp = tp.session.fbp or None
        client_ip = getattr(tp.session, 'ip_address', None) or None

    return send_capi_lifecycle_event(
        pixel_id=pixel_id,
        access_token=access_token,
        event_name=event_type,
        order_id=order.id,
        order_value=order.total_amount,
        phone=order.shipping_phone,
        email=getattr(order.user, 'email', None) if order.user else None,
        fbc=fbc,
        fbp=fbp,
        client_ip=client_ip,
        event_time=real_event_time
    )




