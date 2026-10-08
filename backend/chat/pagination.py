from rest_framework.pagination import CursorPagination


class MessageCursorPagination(CursorPagination):
    page_size = 50
    ordering = "-created_at"
