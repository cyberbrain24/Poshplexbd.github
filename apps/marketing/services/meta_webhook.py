import hmac
import hashlib
import json
import logging
from typing import Dict, Any, Tuple
from django.conf import settings
from apps.marketing.models import Campaign, Creative

logger = logging.getLogger(__name__)

def verify_hub_signature(payload_bytes: bytes, signature_header: str, app_secret: str = "") -> bool:
    """
    Verifies that incoming webhook requests genuinely originate from Meta servers
    using the HMAC-SHA256 signature transmitted in the X-Hub-Signature-256 header.
    """
    secret = app_secret or getattr(settings, 'META_APP_SECRET', '')
    
    # In mock mode or dev test without secret, permit if explicit mock token is present
    if not secret:
        if getattr(settings, 'META_API_MOCK', False) or signature_header == "mock_signature":
            return True
        logger.warning("META_APP_SECRET is not configured; cannot verify webhook signature.")
        return False

    if not signature_header or not signature_header.startswith("sha256="):
        logger.warning(f"Invalid or missing X-Hub-Signature-256 header: {signature_header}")
        return False

    received_sig = signature_header.split("sha256=")[-1].strip()
    computed_sig = hmac.new(
        secret.encode('utf-8'),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(computed_sig, received_sig)


def handle_webhook_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Dispatches and processes real-time webhook change events from Meta Graph API.
    Supported events:
      - ad_rejected (policy violations / disapproval) -> Campaign status = ERROR, records last_error
      - ad_paused -> updates status
      - campaign_paused -> Campaign status = PAUSED
    """
    processed_events = []
    entries = payload.get("entry", [])

    for entry in entries:
        changes = entry.get("changes", [])
        for change in changes:
            field = change.get("field")
            value = change.get("value", {})
            event_type = value.get("event") or value.get("status") or field
            meta_id = value.get("ad_id") or value.get("campaign_id") or entry.get("id")
            reason = value.get("reason") or value.get("disapproval_reason") or "Meta Policy Guidelines Disapproval"

            # 1. Event: ad_rejected / disapproved
            if event_type in ("ad_rejected", "DISAPPROVED", "disapproved") or field == "ad_review_disapproved":
                campaign = None
                if meta_id:
                    # Match by meta_campaign_id or linked through creative
                    campaign = Campaign.objects.filter(meta_campaign_id=meta_id).first()
                    if not campaign:
                        creative = Creative.objects.filter(meta_ad_id=meta_id).select_related('adset__campaign').first()
                        if creative and creative.adset:
                            campaign = creative.adset.campaign

                if campaign:
                    campaign.status = 'ERROR'
                    campaign.last_error = f"Meta Rejection: {reason}"
                    campaign.save(update_fields=['status', 'last_error', 'updated_at'])
                    msg = f"[WEBHOOK ALERT] Campaign '{campaign.name}' (ID #{campaign.id}) flagged as ERROR due to Meta ad rejection: {reason}"
                    logger.error(msg)
                    processed_events.append({"event": "ad_rejected", "campaign_id": campaign.id, "reason": reason})

            # 2. Event: ad_paused / campaign_paused
            elif event_type in ("ad_paused", "campaign_paused", "PAUSED", "paused"):
                if meta_id:
                    campaign = Campaign.objects.filter(meta_campaign_id=meta_id).first()
                    if campaign and campaign.status == 'ACTIVE':
                        campaign.status = 'PAUSED'
                        campaign.save(update_fields=['status', 'updated_at'])
                        logger.info(f"[WEBHOOK] Campaign '{campaign.name}' paused via Meta event.")
                        processed_events.append({"event": "campaign_paused", "campaign_id": campaign.id})

    return {"status": "ok", "events_processed": len(processed_events), "details": processed_events}
