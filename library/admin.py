from django.contrib import admin
from .models import Branch, UserProfile, Client, Accountability

admin.site.register(Branch)
admin.site.register(UserProfile)
admin.site.register(Client)
admin.site.register(Accountability)
