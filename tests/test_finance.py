from decimal import Decimal
from django.test import TestCase
from django.core.exceptions import ValidationError
from apps.finance.models import Account, Transaction, Entry
from apps.finance.services import record_transaction, get_account_balance, LedgerUnbalancedError

class FinanceEngineTestCase(TestCase):
    def setUp(self):
        # Create standard accounts
        self.cash = Account.objects.create(
            name="Cash",
            code="1000-CASH",
            type="asset",
            pl_group="balance_sheet"
        )
        self.revenue = Account.objects.create(
            name="Sales Revenue",
            code="4000-REVENUE",
            type="revenue",
            pl_group="income_statement"
        )
        self.receivables = Account.objects.create(
            name="Accounts Receivable",
            code="1200-RECEIVABLES",
            type="asset",
            pl_group="balance_sheet"
        )

    def test_balanced_transaction_succeeds(self):
        """Test that a balanced double-entry transaction is saved successfully."""
        entries = [
            {"account_code": "1000-CASH", "debit": Decimal("150.00"), "credit": Decimal("0.00")},
            {"account_code": "4000-REVENUE", "debit": Decimal("0.00"), "credit": Decimal("150.00")}
        ]
        
        tx = record_transaction("Sales of street-wear hoodie", entries, reference_id="ord_101")
        
        self.assertIsNotNone(tx.id)
        self.assertEqual(tx.description, "Sales of street-wear hoodie")
        self.assertEqual(tx.entries.count(), 2)
        
        # Verify balances updated correctly
        self.assertEqual(get_account_balance("1000-CASH"), Decimal("150.00"))
        self.assertEqual(get_account_balance("4000-REVENUE"), Decimal("150.00"))

    def test_unbalanced_transaction_fails(self):
        """Test that an unbalanced transaction fails and rolls back fully."""
        entries = [
            {"account_code": "1000-CASH", "debit": Decimal("150.00"), "credit": Decimal("0.00")},
            {"account_code": "4000-REVENUE", "debit": Decimal("0.00"), "credit": Decimal("140.00")}  # missing $10
        ]
        
        initial_tx_count = Transaction.objects.count()
        initial_entry_count = Entry.objects.count()
        
        with self.assertRaises(LedgerUnbalancedError):
            record_transaction("Unbalanced entry", entries)
            
        # Verify db was rolled back and no records were written
        self.assertEqual(Transaction.objects.count(), initial_tx_count)
        self.assertEqual(Entry.objects.count(), initial_entry_count)
        self.assertEqual(get_account_balance("1000-CASH"), Decimal("0.00"))
        self.assertEqual(get_account_balance("4000-REVENUE"), Decimal("0.00"))

    def test_negative_entry_values_fail(self):
        """Test that line items cannot have negative debit or credit values."""
        entries = [
            {"account_code": "1000-CASH", "debit": Decimal("-10.00"), "credit": Decimal("0.00")},
            {"account_code": "4000-REVENUE", "debit": Decimal("0.00"), "credit": Decimal("-10.00")}
        ]
        
        with self.assertRaises(ValidationError):
            record_transaction("Negative values entry", entries)
