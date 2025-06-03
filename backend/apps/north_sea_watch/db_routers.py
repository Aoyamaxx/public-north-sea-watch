class AisDataRouter:
    """
    A router to control database operations for models in the ais_data_collection database.
    """
    # List of models that should use the ais_data database
    ais_models = ['port', 'ship', 'shipdata', 'icctscrubbermarch2025', 'icctwfrcombined']
    
    # List of models that should use the default database
    default_models = ['portcontent', 'usertracking']
    
    def db_for_read(self, model, **hints):
        """
        Attempts to read ais models go to ais_data database.
        """
        if model._meta.app_label == 'north_sea_watch' and model._meta.model_name.lower() in self.ais_models:
            return 'ais_data'
        if model._meta.app_label == 'north_sea_watch' and model._meta.model_name.lower() in self.default_models:
            return 'default'
        return None

    def db_for_write(self, model, **hints):
        """
        Attempts to write ais models go to ais_data database.
        """
        if model._meta.app_label == 'north_sea_watch' and model._meta.model_name.lower() in self.ais_models:
            return 'ais_data'
        if model._meta.app_label == 'north_sea_watch' and model._meta.model_name.lower() in self.default_models:
            return 'default'
        return None

    def allow_relation(self, obj1, obj2, **hints):
        """
        Allow relations if both objects are in the same database.
        """
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        Make sure the ais models don't get migrated to the default database.
        And make sure the default models get migrated to the default database.
        """
        if app_label == 'north_sea_watch' and model_name and model_name.lower() in self.ais_models:
            return db == 'ais_data'
        if app_label == 'north_sea_watch' and model_name and model_name.lower() in self.default_models:
            return db == 'default'
        return None 