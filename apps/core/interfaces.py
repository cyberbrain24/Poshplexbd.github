from apps.core.models import SiteSetting

def get_setting_value(key: str, default=None):
    """
    Public interface to query site settings values.
    Saves direct importing of the SiteSetting model.
    """
    return SiteSetting.get_value(key, default)
