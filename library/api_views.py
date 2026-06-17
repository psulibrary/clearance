from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.db.models import Q
from .models import Client, Accountability, Branch, UserProfile


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ['id', 'name', 'code']


class AccountabilitySerializer(serializers.ModelSerializer):
    resolved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Accountability
        fields = ['id', 'book_title', 'isbn', 'due_date', 'details',
                  'resolved', 'resolved_at', 'resolved_by_name', 'created_at']

    def get_resolved_by_name(self, obj):
        return obj.resolved_by.get_full_name() if obj.resolved_by else None


class ClientListSerializer(serializers.ModelSerializer):
    branch_name = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()
    unresolved_count = serializers.SerializerMethodField()
    total_accountabilities = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = ['id', 'student_id', 'first_name', 'last_name', 'email',
                  'course', 'year_level', 'status', 'clearance_signed', 'remarks',
                  'branch_name', 'uploaded_by_name', 'unresolved_count',
                  'total_accountabilities', 'created_at']

    def get_branch_name(self, obj):
        return obj.branch.name if obj.branch else None

    def get_uploaded_by_name(self, obj):
        if not obj.uploaded_by:
            return None
        return obj.uploaded_by.get_full_name() or obj.uploaded_by.username

    def get_unresolved_count(self, obj):
        return obj.accountabilities.filter(resolved=False).count()

    def get_total_accountabilities(self, obj):
        return obj.accountabilities.count()


class ClientDetailSerializer(ClientListSerializer):
    accountabilities = AccountabilitySerializer(many=True)

    class Meta(ClientListSerializer.Meta):
        fields = ClientListSerializer.Meta.fields + ['accountabilities']


def get_role(user):
    if user.is_superuser:
        return 'main_library'
    try:
        return user.profile.role
    except UserProfile.DoesNotExist:
        return None


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(request, username=username, password=password)
        if not user:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        role = get_role(user)
        branch = None
        branch_id = None
        try:
            if user.profile.branch:
                branch = user.profile.branch.name
                branch_id = user.profile.branch.id
        except UserProfile.DoesNotExist:
            pass

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'full_name': user.get_full_name() or user.username,
                'role': role,
                'branch': branch,
                'branch_id': branch_id,
            }
        })


class StatsView(APIView):
    def get(self, request):
        return Response({
            'total': Client.objects.count(),
            'pending': Client.objects.filter(status='pending').count(),
            'cleared': Client.objects.filter(status='cleared').count(),
            'rejected': Client.objects.filter(status='rejected').count(),
        })


class BranchListView(APIView):
    def get(self, request):
        return Response(BranchSerializer(Branch.objects.all(), many=True).data)


class ClientListView(APIView):
    def get(self, request):
        role = get_role(request.user)
        if role == 'library_in_charge':
            clients = Client.objects.filter(uploaded_by=request.user)
        else:
            clients = Client.objects.all()
            status_filter = request.query_params.get('status', '')
            branch_filter = request.query_params.get('branch', '')
            search = request.query_params.get('search', '')
            if status_filter:
                clients = clients.filter(status=status_filter)
            if branch_filter:
                clients = clients.filter(branch__id=branch_filter)
            if search:
                clients = clients.filter(
                    Q(student_id__icontains=search) |
                    Q(first_name__icontains=search) |
                    Q(last_name__icontains=search)
                )

        clients = clients.select_related('branch', 'uploaded_by').prefetch_related('accountabilities')
        return Response(ClientListSerializer(clients, many=True).data)

    def post(self, request):
        if get_role(request.user) != 'library_in_charge':
            return Response({'error': 'Permission denied'}, status=403)
        data = request.data
        try:
            branch = None
            try:
                branch = request.user.profile.branch
            except UserProfile.DoesNotExist:
                pass
            client = Client.objects.create(
                student_id=data['student_id'],
                first_name=data['first_name'],
                last_name=data['last_name'],
                email=data['email'],
                course=data.get('course', ''),
                year_level=data.get('year_level', ''),
                uploaded_by=request.user,
                branch=branch,
            )
            return Response(ClientListSerializer(client).data, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class ClientDetailView(APIView):
    def get(self, request, pk):
        try:
            client = Client.objects.prefetch_related('accountabilities').get(pk=pk)
        except Client.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        role = get_role(request.user)
        if role == 'library_in_charge' and client.uploaded_by != request.user:
            return Response({'error': 'Permission denied'}, status=403)
        return Response(ClientDetailSerializer(client).data)


class ClientDecideView(APIView):
    def post(self, request, pk):
        if get_role(request.user) != 'main_library':
            return Response({'error': 'Permission denied'}, status=403)
        try:
            client = Client.objects.get(pk=pk)
        except Client.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        decision = request.data.get('decision')
        remarks = request.data.get('remarks', '')
        if decision == 'approve':
            client.status = 'cleared'
            client.clearance_signed = True
        elif decision == 'reject':
            client.status = 'rejected'
            client.clearance_signed = False
        else:
            return Response({'error': 'Invalid decision. Use approve or reject.'}, status=400)
        client.remarks = remarks
        client.save()
        return Response(ClientDetailSerializer(client).data)


class AccountabilityAddView(APIView):
    def post(self, request, client_pk):
        if get_role(request.user) != 'library_in_charge':
            return Response({'error': 'Permission denied'}, status=403)
        try:
            client = Client.objects.get(pk=client_pk, uploaded_by=request.user)
        except Client.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        data = request.data
        if not data.get('book_title'):
            return Response({'error': 'book_title is required'}, status=400)

        acc = Accountability.objects.create(
            client=client,
            book_title=data['book_title'],
            isbn=data.get('isbn', ''),
            due_date=data.get('due_date') or None,
            details=data.get('details', ''),
            added_by=request.user,
        )
        return Response(AccountabilitySerializer(acc).data, status=201)


class AccountabilityResolveView(APIView):
    def post(self, request, pk):
        try:
            acc = Accountability.objects.get(pk=pk)
        except Accountability.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        role = get_role(request.user)
        if role == 'library_in_charge' and acc.added_by != request.user:
            return Response({'error': 'Permission denied'}, status=403)
        acc.resolve(request.user)
        return Response(AccountabilitySerializer(acc).data)


class SendRemindersView(APIView):
    def post(self, request):
        if get_role(request.user) != 'main_library':
            return Response({'error': 'Permission denied'}, status=403)

        pending_clients = Client.objects.filter(status='pending').prefetch_related('accountabilities')
        sent = 0
        for client in pending_clients:
            unresolved = client.unresolved_accountabilities
            if unresolved.exists() and client.email:
                subject = f'Library Clearance Reminder – {client.student_id}'
                items = '\n'.join([
                    f"  • {a.book_title}" + (f" (Due: {a.due_date})" if a.due_date else "")
                    for a in unresolved
                ])
                body = (
                    f"Dear {client.full_name},\n\n"
                    f"You have pending library accountabilities:\n{items}\n\n"
                    f"Please return them immediately.\n\nLibrary Clearance Office\nPalawan State University"
                )
                try:
                    send_mail(subject, body, None, [client.email], fail_silently=False)
                    sent += 1
                except Exception:
                    pass
        return Response({'sent': sent, 'message': f'Reminders sent to {sent} client(s).'})
