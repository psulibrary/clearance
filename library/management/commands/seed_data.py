from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from library.models import Branch, UserProfile, Client, Accountability
from django.utils import timezone
import datetime


class Command(BaseCommand):
    help = 'Seed initial data for the clearance system'

    def handle(self, *args, **options):
        # Create branches
        main_branch, _ = Branch.objects.get_or_create(name='Main Library', code='MAIN')
        sci_branch, _ = Branch.objects.get_or_create(name='Science & Technology Branch', code='SCI')
        self.stdout.write('Branches created.')

        # Create main_library user
        main_user, created = User.objects.get_or_create(username='main_lib')
        if created:
            main_user.set_password('lib123')
            main_user.first_name = 'Main'
            main_user.last_name = 'Library'
            main_user.email = 'mainlib@psu.edu.ph'
            main_user.save()
        UserProfile.objects.get_or_create(user=main_user, defaults={'role': 'main_library'})
        self.stdout.write('main_lib user created (password: lib123)')

        # Create library_in_charge user
        branch_user, created = User.objects.get_or_create(username='branch1')
        if created:
            branch_user.set_password('branch123')
            branch_user.first_name = 'Branch'
            branch_user.last_name = 'Librarian'
            branch_user.email = 'branch1@psu.edu.ph'
            branch_user.save()
        UserProfile.objects.get_or_create(user=branch_user, defaults={'role': 'library_in_charge', 'branch': main_branch})
        self.stdout.write('branch1 user created (password: branch123)')

        # Create sample clients
        c1, _ = Client.objects.get_or_create(
            student_id='2021-00001',
            defaults={
                'first_name': 'Juan', 'last_name': 'Dela Cruz',
                'email': 'juan@example.com', 'course': 'BS Computer Science',
                'year_level': '4th Year', 'uploaded_by': branch_user,
                'branch': main_branch, 'status': 'pending'
            }
        )
        c2, _ = Client.objects.get_or_create(
            student_id='2021-00002',
            defaults={
                'first_name': 'Maria', 'last_name': 'Santos',
                'email': 'maria@example.com', 'course': 'BS Nursing',
                'year_level': '3rd Year', 'uploaded_by': branch_user,
                'branch': main_branch, 'status': 'pending'
            }
        )

        # Add accountabilities
        Accountability.objects.get_or_create(
            client=c1, book_title='Introduction to Algorithms',
            defaults={'isbn': '978-0262033848', 'due_date': datetime.date(2024, 12, 1),
                      'details': 'Book not returned after loan period expired.', 'added_by': branch_user}
        )
        Accountability.objects.get_or_create(
            client=c1, book_title='Clean Code',
            defaults={'isbn': '978-0132350884', 'due_date': datetime.date(2024, 11, 15),
                      'details': 'Overdue for 3 months.', 'added_by': branch_user}
        )
        Accountability.objects.get_or_create(
            client=c2, book_title='Fundamentals of Nursing',
            defaults={'isbn': '978-0323827386', 'due_date': datetime.date(2025, 1, 10),
                      'details': 'Borrowed for clinical practice reference.', 'added_by': branch_user}
        )
        self.stdout.write(self.style.SUCCESS('Sample data seeded successfully!'))
