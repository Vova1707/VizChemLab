from sqladmin import ModelView
from db.models import User

class UserAdmin(ModelView, model=User):
    # Название в меню
    name = "Пользователь"
    name_plural = "Пользователи"

    # Поля, отображаемые в списке
    column_list = [User.id, User.username, User.email, User.is_admin]

    # Поля, по которым можно искать
    column_searchable_list = [User.username, User.email]

    # Поля, по которым можно сортировать
    column_sortable_list = [User.id, User.is_admin]

    # Поля, которые можно редактировать (пароль скрыт)
    form_excluded_columns = [User.hashed_password]

    # Разрешить создание/редактирование/удаление
    can_create = True
    can_edit = True
    can_delete = True
    can_view_details = True