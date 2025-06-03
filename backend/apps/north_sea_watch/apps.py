from django.apps import AppConfig

class NorthSeaWatchConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.north_sea_watch'

    def ready(self):
        """Import signals when the app is ready."""
        import apps.north_sea_watch.signals  # noqa