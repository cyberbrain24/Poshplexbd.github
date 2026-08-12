from django.test import TestCase
from apps.core.models import SiteSetting
from apps.integration.services import get_sms_provider, get_email_provider, get_courier_provider
from apps.integration.providers.sms import MockSMSProvider, TwilioSMSProvider
from apps.integration.providers.email import MockEmailProvider, SendGridEmailProvider
from apps.integration.providers.courier import MockCourierProvider, DHLCourierProvider

class IntegrationLayerTestCase(TestCase):
    def setUp(self):
        # Clean any existing setting configurations
        SiteSetting.objects.all().delete()

    def test_default_providers_fallback_to_mocks(self):
        """Verify that provider factories resolve to Mock implementations if settings are unconfigured."""
        sms_provider = get_sms_provider()
        email_provider = get_email_provider()
        courier_provider = get_courier_provider()
        
        self.assertIsInstance(sms_provider, MockSMSProvider)
        self.assertIsInstance(email_provider, MockEmailProvider)
        self.assertIsInstance(courier_provider, MockCourierProvider)

    def test_provider_swapping_via_settings(self):
        """Verify that providers resolve to concrete configured services when Settings are updated."""
        # 1. Update active site setting configuration
        SiteSetting.objects.create(
            key="integration_providers",
            value={
                "sms_provider": "twilio",
                "twilio_credentials": {
                    "account_sid": "LIVE-AC-SID-99",
                    "auth_token": "LIVE-AUTH-TOKEN-99",
                    "from_number": "+15551234567"
                },
                "email_provider": "sendgrid",
                "sendgrid_credentials": {
                    "api_key": "SG.KeyName.SecretCode",
                    "from_email": "hello@poshplexbd.com"
                },
                "courier_provider": "dhl",
                "dhl_credentials": {
                    "api_key": "dhl_api_key_secret",
                    "account_number": "DHL-ACCT-88"
                }
            }
        )

        # 2. Re-resolve providers and verify dynamic class updates
        sms_provider = get_sms_provider()
        email_provider = get_email_provider()
        courier_provider = get_courier_provider()

        self.assertIsInstance(sms_provider, TwilioSMSProvider)
        self.assertEqual(sms_provider.account_sid, "LIVE-AC-SID-99")
        self.assertEqual(sms_provider.from_number, "+15551234567")

        self.assertIsInstance(email_provider, SendGridEmailProvider)
        self.assertEqual(email_provider.from_email, "hello@poshplexbd.com")

        self.assertIsInstance(courier_provider, DHLCourierProvider)
        self.assertEqual(courier_provider.account_number, "DHL-ACCT-88")
