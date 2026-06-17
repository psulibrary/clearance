from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Branch(models.Model):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = 'Branches'


class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('main_library', 'Main Library'),
        ('library_in_charge', 'Library In Charge'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=30, choices=ROLE_CHOICES)
    branch = models.ForeignKey(Branch, null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"


class Client(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('cleared', 'Cleared'),
        ('rejected', 'Rejected'),
    ]
    student_id = models.CharField(max_length=50, unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField()
    course = models.CharField(max_length=200, blank=True)
    year_level = models.CharField(max_length=20, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='uploaded_clients')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, related_name='clients')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    clearance_signed = models.BooleanField(default=False)
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.student_id} - {self.full_name}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def has_unresolved_accountabilities(self):
        return self.accountabilities.filter(resolved=False).exists()

    @property
    def unresolved_accountabilities(self):
        return self.accountabilities.filter(resolved=False)

    class Meta:
        ordering = ['-created_at']


class Accountability(models.Model):
    client = models.ForeignKey(Client, related_name='accountabilities', on_delete=models.CASCADE)
    book_title = models.CharField(max_length=300)
    isbn = models.CharField(max_length=30, blank=True)
    due_date = models.DateField(null=True, blank=True)
    details = models.TextField(blank=True)
    resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_accountabilities')
    created_at = models.DateTimeField(auto_now_add=True)
    added_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='added_accountabilities')

    def __str__(self):
        return f"{self.book_title} ({self.client.student_id})"

    def resolve(self, user):
        self.resolved = True
        self.resolved_at = timezone.now()
        self.resolved_by = user
        self.save()

    class Meta:
        ordering = ['resolved', '-created_at']
