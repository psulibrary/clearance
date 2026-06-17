from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core.mail import send_mail
from django.db.models import Q
from django.utils import timezone
from .models import Client, Accountability, Branch, UserProfile
from .forms import ClientForm, AccountabilityForm, ClearanceDecisionForm


def get_user_role(user):
    try:
        return user.profile.role
    except UserProfile.DoesNotExist:
        return None


def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user:
            login(request, user)
            return redirect('dashboard')
        messages.error(request, 'Invalid username or password.')
    return render(request, 'library/login.html')


def logout_view(request):
    logout(request)
    return redirect('login')


@login_required
def dashboard(request):
    role = get_user_role(request.user)
    if role == 'main_library' or request.user.is_superuser:
        return redirect('dashboard_main')
    elif role == 'library_in_charge':
        return redirect('dashboard_branch')
    messages.error(request, 'Your account has no role assigned. Contact admin.')
    return redirect('login')


@login_required
def dashboard_main(request):
    if not (get_user_role(request.user) == 'main_library' or request.user.is_superuser):
        messages.error(request, 'Access denied.')
        return redirect('dashboard')

    status_filter = request.GET.get('status', '')
    branch_filter = request.GET.get('branch', '')
    search = request.GET.get('search', '')

    clients = Client.objects.select_related('branch', 'uploaded_by').prefetch_related('accountabilities')

    if status_filter:
        clients = clients.filter(status=status_filter)
    if branch_filter:
        clients = clients.filter(branch__id=branch_filter)
    if search:
        clients = clients.filter(
            Q(student_id__icontains=search) |
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(email__icontains=search)
        )

    total = Client.objects.count()
    pending = Client.objects.filter(status='pending').count()
    cleared = Client.objects.filter(status='cleared').count()
    rejected = Client.objects.filter(status='rejected').count()
    branches = Branch.objects.all()

    return render(request, 'library/dashboard_main.html', {
        'clients': clients,
        'total': total,
        'pending': pending,
        'cleared': cleared,
        'rejected': rejected,
        'branches': branches,
        'status_filter': status_filter,
        'branch_filter': branch_filter,
        'search': search,
    })


@login_required
def dashboard_branch(request):
    if get_user_role(request.user) != 'library_in_charge':
        messages.error(request, 'Access denied.')
        return redirect('dashboard')

    clients = Client.objects.filter(uploaded_by=request.user).prefetch_related('accountabilities')
    return render(request, 'library/dashboard_branch.html', {'clients': clients})


@login_required
def client_create(request):
    if get_user_role(request.user) != 'library_in_charge':
        messages.error(request, 'Access denied.')
        return redirect('dashboard')

    if request.method == 'POST':
        form = ClientForm(request.POST)
        if form.is_valid():
            client = form.save(commit=False)
            client.uploaded_by = request.user
            try:
                client.branch = request.user.profile.branch
            except UserProfile.DoesNotExist:
                pass
            client.save()
            messages.success(request, f'Client {client.full_name} added successfully.')
            return redirect('client_detail', pk=client.pk)
    else:
        form = ClientForm()

    return render(request, 'library/client_form.html', {'form': form, 'action': 'Add'})


@login_required
def client_detail(request, pk):
    client = get_object_or_404(Client, pk=pk)
    role = get_user_role(request.user)

    # Branch users can only see their own clients
    if role == 'library_in_charge' and client.uploaded_by != request.user:
        messages.error(request, 'Access denied.')
        return redirect('dashboard')

    accountability_form = AccountabilityForm()
    return render(request, 'library/client_detail.html', {
        'client': client,
        'accountability_form': accountability_form,
        'role': role,
        'today': timezone.now().date(),
    })


@login_required
def accountability_add(request, client_pk):
    if get_user_role(request.user) != 'library_in_charge':
        messages.error(request, 'Access denied.')
        return redirect('dashboard')

    client = get_object_or_404(Client, pk=client_pk, uploaded_by=request.user)
    if request.method == 'POST':
        form = AccountabilityForm(request.POST)
        if form.is_valid():
            acc = form.save(commit=False)
            acc.client = client
            acc.added_by = request.user
            acc.save()
            messages.success(request, f'Accountability "{acc.book_title}" added.')
    return redirect('client_detail', pk=client_pk)


@login_required
def accountability_resolve(request, pk):
    acc = get_object_or_404(Accountability, pk=pk)
    role = get_user_role(request.user)

    if role == 'library_in_charge' and acc.added_by != request.user:
        messages.error(request, 'Access denied.')
        return redirect('dashboard')
    if role not in ('library_in_charge', 'main_library') and not request.user.is_superuser:
        messages.error(request, 'Access denied.')
        return redirect('dashboard')

    if request.method == 'POST':
        acc.resolve(request.user)
        client = acc.client
        if not client.has_unresolved_accountabilities:
            pass
        messages.success(request, f'Accountability "{acc.book_title}" marked as resolved.')

    return redirect('client_detail', pk=acc.client.pk)


@login_required
def clearance_decide(request, client_pk):
    if not (get_user_role(request.user) == 'main_library' or request.user.is_superuser):
        messages.error(request, 'Access denied.')
        return redirect('dashboard')

    client = get_object_or_404(Client, pk=client_pk)
    if request.method == 'POST':
        form = ClearanceDecisionForm(request.POST)
        if form.is_valid():
            decision = form.cleaned_data['decision']
            remarks = form.cleaned_data['remarks']
            if decision == 'approve':
                client.status = 'cleared'
                client.clearance_signed = True
                client.remarks = remarks
                msg = f'Clearance approved and signed for {client.full_name}.'
            else:
                client.status = 'rejected'
                client.clearance_signed = False
                client.remarks = remarks
                msg = f'Clearance rejected for {client.full_name}.'
            client.save()
            messages.success(request, msg)
            return redirect('dashboard_main')
    return redirect('client_detail', pk=client_pk)


@login_required
def send_reminders(request):
    if not (get_user_role(request.user) == 'main_library' or request.user.is_superuser):
        messages.error(request, 'Access denied.')
        return redirect('dashboard')

    if request.method == 'POST':
        pending_clients = Client.objects.filter(status='pending').prefetch_related('accountabilities')
        sent_count = 0
        for client in pending_clients:
            unresolved = client.unresolved_accountabilities
            if unresolved.exists() and client.email:
                subject = f'Library Clearance Reminder - {client.student_id}'
                items = '\n'.join([
                    f"  - {a.book_title}"
                    + (f" (Due: {a.due_date})" if a.due_date else "")
                    + (f"\n    Details: {a.details}" if a.details else "")
                    for a in unresolved
                ])
                body = (
                    f"Dear {client.full_name},\n\n"
                    f"This is a reminder that you have pending library accountabilities "
                    f"that must be settled before your clearance can be approved.\n\n"
                    f"UNRETURNED/UNRESOLVED ITEMS:\n{items}\n\n"
                    f"Please return the above items to the library as soon as possible.\n\n"
                    f"If you believe this is an error, please contact the library.\n\n"
                    f"Thank you,\nLibrary Clearance Office\nPalawan State University"
                )
                try:
                    send_mail(subject, body, None, [client.email], fail_silently=False)
                    sent_count += 1
                except Exception as e:
                    messages.warning(request, f'Failed to send reminder to {client.email}: {e}')

        messages.success(request, f'Reminders sent to {sent_count} client(s) with unresolved accountabilities.')

    return redirect('dashboard_main')
