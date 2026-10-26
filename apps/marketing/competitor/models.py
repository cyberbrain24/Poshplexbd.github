"""
Re-export competitor intelligence models for apps.marketing.competitor namespace.
"""
from apps.marketing.models import (
    Competitor,
    CompetitorAd,
    CompetitorInsight,
    CompetitorSnapshot,
)

__all__ = [
    'Competitor',
    'CompetitorAd',
    'CompetitorInsight',
    'CompetitorSnapshot',
]
