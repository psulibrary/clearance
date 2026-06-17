from django import forms
from .models import Client, Accountability


class ClientForm(forms.ModelForm):
    class Meta:
        model = Client
        fields = ['student_id', 'first_name', 'last_name', 'email', 'course', 'year_level']
        widgets = {
            'student_id': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. 2021-00001'}),
            'first_name': forms.TextInput(attrs={'class': 'form-control'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
            'course': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. BS Computer Science'}),
            'year_level': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. 4th Year'}),
        }


class AccountabilityForm(forms.ModelForm):
    class Meta:
        model = Accountability
        fields = ['book_title', 'isbn', 'due_date', 'details']
        widgets = {
            'book_title': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Full book title'}),
            'isbn': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Optional'}),
            'due_date': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'details': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Additional details or notes'}),
        }


class ClearanceDecisionForm(forms.Form):
    DECISION_CHOICES = [('approve', 'Approve & Sign Clearance'), ('reject', 'Reject Clearance')]
    decision = forms.ChoiceField(choices=DECISION_CHOICES, widget=forms.RadioSelect())
    remarks = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Optional remarks or notes'})
    )
