from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from library.models import Client


class Command(BaseCommand):
    help = 'Send email reminders to clients with uncleared accountabilities'

    def handle(self, *args, **options):
        pending_clients = Client.objects.filter(status='pending').prefetch_related('accountabilities')
        sent = 0
        for client in pending_clients:
            unresolved = client.unresolved_accountabilities
            if unresolved.exists() and client.email:
                subject = f'Library Clearance Reminder - {client.student_id}'
                items = '\n'.join([
                    f"  - {a.book_title}" + (f" (Due: {a.due_date})" if a.due_date else "")
                    for a in unresolved
                ])
                body = (
                    f"Dear {client.full_name},\n\n"
                    f"You have pending library accountabilities:\n{items}\n\n"
                    f"Please return them immediately.\n\nLibrary Clearance Office"
                )
                send_mail(subject, body, None, [client.email], fail_silently=True)
                sent += 1
                self.stdout.write(f'  Sent to {client.email}')
        self.stdout.write(self.style.SUCCESS(f'Done. Sent {sent} reminders.'))
