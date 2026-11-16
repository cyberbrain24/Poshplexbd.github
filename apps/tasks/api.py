from ninja import Router, Schema
from typing import List, Optional
from django.shortcuts import get_object_or_404
from apps.core.api import BearerAuth, enforce_permission
from .models import Task, TaskCategory
from apps.core.models import User

router = Router()

class TaskCategorySchema(Schema):
    id: int
    name: str
    color: str
    task_count: Optional[int] = 0

class TaskCategoryInputSchema(Schema):
    name: str
    color: Optional[str] = "#3b82f6"

class TaskSchema(Schema):
    id: int
    title: str
    description: Optional[str]
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    assignee_id: int
    assignee_username: str
    created_by_username: str
    status: str
    completion_comment: Optional[str]
    created_at: str
    completed_at: Optional[str]

class TaskInputSchema(Schema):
    title: str
    description: Optional[str] = None
    category_id: Optional[int] = None
    assignee_id: int

class TaskCompleteSchema(Schema):
    comment: Optional[str] = None

def _serialize_task(task: Task) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "category_id": task.category_id,
        "category_name": task.category.name if task.category else None,
        "category_color": task.category.color if task.category else None,
        "assignee_id": task.assignee_id,
        "assignee_username": task.assignee.username if task.assignee else "",
        "created_by_username": task.created_by.username if task.created_by else "",
        "status": task.status,
        "completion_comment": task.completion_comment,
        "created_at": task.created_at.isoformat(),
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }

# --- Category Endpoints ---

@router.get("/categories", response=List[TaskCategorySchema], auth=BearerAuth())
def list_categories(request):
    """List all task categories with task counts."""
    enforce_permission(request, "tasks", "view")
    categories = TaskCategory.objects.all().order_by('name')
    res = []
    for cat in categories:
        res.append({
            "id": cat.id,
            "name": cat.name,
            "color": cat.color,
            "task_count": cat.tasks.filter(status='pending').count()
        })
    return res

@router.post("/categories", response=TaskCategorySchema, auth=BearerAuth())
def create_category(request, data: TaskCategoryInputSchema):
    """Create a new task category."""
    enforce_permission(request, "tasks", "create")
    clean_name = data.name.strip()
    category, _ = TaskCategory.objects.get_or_create(
        name=clean_name,
        defaults={"color": data.color or "#3b82f6"}
    )
    return {
        "id": category.id,
        "name": category.name,
        "color": category.color,
        "task_count": category.tasks.filter(status='pending').count()
    }

@router.delete("/categories/{int:category_id}", auth=BearerAuth())
def delete_category(request, category_id: int):
    """Delete a task category."""
    enforce_permission(request, "tasks", "delete")
    cat = get_object_or_404(TaskCategory, id=category_id)
    cat.delete()
    return {"success": True}

# --- Task Endpoints ---

@router.get("/", response=List[TaskSchema], auth=BearerAuth())
def list_tasks(request, status: Optional[str] = None, category_id: Optional[int] = None):
    """
    List tasks.
    Superadmins or users with tasks.view can see all tasks (or filtered).
    Normal staff only see their own tasks.
    """
    user = request.auth
    
    qs = Task.objects.select_related('assignee', 'created_by', 'category')
    
    # First, verify they have basic access to the module
    enforce_permission(request, "tasks", "view")
    
    if status:
        qs = qs.filter(status=status)
    if category_id:
        qs = qs.filter(category_id=category_id)
        
    # Superadmins can see all tasks.
    # Normal staff can only see their own assigned tasks or tasks they created.
    if user.is_superuser:
        pass # Can view all tasks
    else:
        from django.db.models import Q
        qs = qs.filter(Q(assignee=user) | Q(created_by=user))
        
    qs = qs.order_by('-created_at')
    return [_serialize_task(t) for t in qs]


@router.post("/", response=TaskSchema, auth=BearerAuth())
def create_task(request, data: TaskInputSchema):
    """Superadmin or users with tasks.create can create tasks."""
    enforce_permission(request, "tasks", "create")
    
    assignee = get_object_or_404(User, id=data.assignee_id)
    category = None
    if data.category_id:
        category = TaskCategory.objects.filter(id=data.category_id).first()
    
    task = Task.objects.create(
        title=data.title,
        description=data.description,
        category=category,
        assignee=assignee,
        created_by=request.auth,
        status="pending"
    )
    return _serialize_task(task)


@router.put("/{task_id}", response=TaskSchema, auth=BearerAuth())
def update_task(request, task_id: int, data: TaskInputSchema):
    """Superadmin or users with tasks.edit can edit tasks."""
    enforce_permission(request, "tasks", "edit")
    
    task = get_object_or_404(Task, id=task_id)
    assignee = get_object_or_404(User, id=data.assignee_id)
    category = None
    if data.category_id:
        category = TaskCategory.objects.filter(id=data.category_id).first()
    
    task.title = data.title
    task.description = data.description
    task.category = category
    task.assignee = assignee
    task.save()
    
    return _serialize_task(task)


@router.put("/{task_id}/complete", response=TaskSchema, auth=BearerAuth())
def complete_task(request, task_id: int, data: TaskCompleteSchema):
    """
    Mark a task as completed.
    Can be done by the assignee, superadmin, or someone with tasks.edit.
    """
    user = request.auth
    task = get_object_or_404(Task, id=task_id)
    
    if not (user.is_superuser or user.has_module_permission("tasks", "edit") or task.assignee == user):
        from ninja.errors import HttpError
        raise HttpError(403, "Forbidden: You do not have permission to complete this task.")
        
    task.status = "completed"
    task.completion_comment = data.comment
    from django.utils import timezone
    task.completed_at = timezone.now()
    task.save()
    
    return _serialize_task(task)


@router.delete("/{task_id}", auth=BearerAuth())
def delete_task(request, task_id: int):
    """Delete a task."""
    enforce_permission(request, "tasks", "delete")
    task = get_object_or_404(Task, id=task_id)
    task.delete()
    return {"success": True}
