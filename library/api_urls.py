from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import api_views

urlpatterns = [
    path('auth/login/', api_views.LoginView.as_view()),
    path('auth/refresh/', TokenRefreshView.as_view()),
    path('stats/', api_views.StatsView.as_view()),
    path('branches/', api_views.BranchListView.as_view()),
    path('clients/', api_views.ClientListView.as_view()),
    path('clients/<int:pk>/', api_views.ClientDetailView.as_view()),
    path('clients/<int:pk>/decide/', api_views.ClientDecideView.as_view()),
    path('clients/<int:client_pk>/accountabilities/', api_views.AccountabilityAddView.as_view()),
    path('accountabilities/<int:pk>/resolve/', api_views.AccountabilityResolveView.as_view()),
    path('send-reminders/', api_views.SendRemindersView.as_view()),
]
