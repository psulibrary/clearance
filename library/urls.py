from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard_root'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('dashboard/main/', views.dashboard_main, name='dashboard_main'),
    path('dashboard/branch/', views.dashboard_branch, name='dashboard_branch'),
    path('clients/new/', views.client_create, name='client_create'),
    path('clients/<int:pk>/', views.client_detail, name='client_detail'),
    path('clients/<int:client_pk>/accountability/add/', views.accountability_add, name='accountability_add'),
    path('accountability/<int:pk>/resolve/', views.accountability_resolve, name='accountability_resolve'),
    path('clients/<int:client_pk>/decide/', views.clearance_decide, name='clearance_decide'),
    path('send-reminders/', views.send_reminders, name='send_reminders'),
]
