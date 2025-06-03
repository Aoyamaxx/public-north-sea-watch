"""
Management command to clean up old ship data from the ship_data table.
This command removes data older than 3 months from the current date.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from django.db import connections
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Clean up ship_data table by removing data older than 3 months'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show how many records would be deleted without actually deleting them',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=10000,
            help='Number of records to delete in each batch (default: 10000)',
        )

    def handle(self, *args, **options):
        try:
            # Calculate the cutoff date (3 months ago)
            cutoff_date = timezone.now() - relativedelta(months=3)
            cutoff_date_str = cutoff_date.strftime('%Y-%m-%d %H:%M:%S')
            
            self.stdout.write(f"Starting cleanup of ship_data table for data older than {cutoff_date_str}")
            
            # Use a database connection to the ais_data database
            with connections['ais_data'].cursor() as cursor:
                # First, get the count of records to be deleted
                cursor.execute(
                    "SELECT COUNT(*) FROM ship_data WHERE timestamp_ais < %s",
                    [cutoff_date]
                )
                count = cursor.fetchone()[0]
                
                if options['dry_run']:
                    self.stdout.write(
                        self.style.SUCCESS(f"Dry run: {count} records would be deleted")
                    )
                    return
                
                if count == 0:
                    self.stdout.write(
                        self.style.SUCCESS("No records found to delete")
                    )
                    return
                
                # If count is large, delete in batches to avoid long locks
                batch_size = options['batch_size']
                total_deleted = 0
                
                self.stdout.write(f"Found {count} records to delete. Proceeding with batch size of {batch_size}")
                
                while total_deleted < count:
                    # PostgreSQL doesn't support LIMIT in DELETE directly, so use this approach
                    cursor.execute(
                        """
                        DELETE FROM ship_data
                        WHERE id IN (
                            SELECT id FROM ship_data
                            WHERE timestamp_ais < %s
                            ORDER BY id
                            LIMIT %s
                        )
                        """,
                        [cutoff_date, batch_size]
                    )
                    
                    deleted_in_batch = cursor.rowcount
                    total_deleted += deleted_in_batch
                    
                    # Log progress
                    self.stdout.write(
                        f"Deleted batch of {deleted_in_batch} records. Progress: {total_deleted}/{count}"
                    )
                    
                    # If we deleted fewer records than the batch size, we're done
                    if deleted_in_batch < batch_size:
                        break
            
            self.stdout.write(
                self.style.SUCCESS(f"Successfully deleted {total_deleted} records older than 3 months")
            )
            
        except Exception as e:
            logger.error(f"Error cleaning up ship_data: {str(e)}")
            self.stdout.write(
                self.style.ERROR(f"Failed to clean up ship_data: {str(e)}")
            ) 