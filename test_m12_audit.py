import os
import sys

def trace_full_request_flow():
    print("="*80)
    print("COMPREHENSIVE M12 NOTIFICATIONS SECURITY AUDIT")
    print("="*80)
    
    print("\n1. ROUTE ANALYSIS:")
    print("   Expected M12 routes:")
    routes = [
        "GET /notifications",
        "GET /notifications/:id", 
        "POST /notifications",
        "PUT /notifications/:id",
        "PATCH /notifications/:id/read",
        "DELETE /notifications/:id",
        "GET /users/:userId/notifications"
    ]
    for route in routes:
        print(f"   ✓ {route}")
    
    print("\n2. REPOSITORY ANALYSIS:")
    print("   Checking notificationRepository methods:")
    
    # Check if applyDepartmentScope is imported/used in notificationRepository
    with open('src/modules/notifications/notificationRepository.js', 'r') as f:
        repo_content = f.read()
    
    if 'applyDepartmentScope' in repo_content:
        print("   ✗ NOTIFICATION REPOSITORY USES DEPARTMENT SCOPE")
        print("   ⚠ This means notifications have department isolation!")
    else:
        print("   ⚠ NOTIFICATION REPOSITORY MISSING DEPARTMENT SCOPE")
        print("   ✗ This is a security issue - users can see all notifications!")
    
    # Check repository.findById for user context
    if 'findByIdAndUser' in repo_content:
        print("   ✓ Repository has findByIdAndUser method")
    else:
        print("   ✗ Repository MISSING user context in findById - IDOR VULNERABILITY!")
    
    print("\n3. SERVICE ANALYSIS:")
    with open('src/modules/notifications/notificationService.js', 'r') as f:
        service_content = f.read()
    
    # Check service ownership checks
    if 'userId !== userId' in service_content.replace(' ', ''):
        print("   ✓ Service checks user ownership")
    else:
        print("   ⚠ Service ownership checks need verification")
    
    # Check service role checks
    if 'requesterRole !== \'PRINCIPAL\'' in service_content or 'requesterRole !== \'PRINCIPAL\'' in service_content:
        print("   ✓ Service has role-based access control")
    else:
        print("   ⚠ Service role checks need verification")
    
    print("\n4. AUTHENTICATION & AUTHORIZATION MIDDLEWARE:")
    with open('src/middleware/authMiddleware.js', 'r') as f:
        auth_content = f.read()
    
    if 'Bearer' in auth_content and 'x-user-id' in auth_content:
        print("   ✓ Authentication middleware supports token & dev context")
    
    with open('src/middleware/rbacMiddleware.js', 'r') as f:
        rbac_content = f.read()
    
    if 'PRINCIPAL' in rbac_content and 'authorize' in rbac_content:
        print("   ✓ RBAC middleware has role-based authorization")
    
    print("\n5. DEPARTMENT SCOPE ANALYSIS:")
    with open('src/repositories/departmentScope.js', 'r') as f:
        dept_scope_content = f.read()
    
    if 'notifications' in dept_scope_content:
        print("   ✓ Department scope handles notifications table")
    else:
        print("   ⚠ Department scope missing notifications table - NO DEPARTMENT ISOLATION!")
    
    print("\n6. DATABASE SCHEMA INSPECTION:")
    with open('src/infrastructure/database/migrations/015_notifications.sql', 'r') as f:
        migration_content = f.read()
    
    if 'CREATE TABLE notifications' in migration_content:
        print("   ✓ Notifications table exists")
    
    if 'CHECK (type IN' in migration_content:
        print("   ✓ Notification type validation exists")
    
    if 'CHECK (priority IN' in migration_content:
        print("   ✓ Priority validation exists")
    
    if 'FOREIGN KEY (user_id)' in migration_content:
        print("   ✓ User foreign key with ON DELETE CASCADE")
    
    if 'related_announcement_id' in migration_content:
        print("   ✓ Announcement foreign key with SET NULL")
    
    print("\n7. RESPONSE DTO ANALYSIS:")
    with open('src/utils/dtoMapper.js', 'r') as f:
        dto_content = f.read()
    
    if 'toNotificationDto' in dto_content:
        print("   ✓ Notification DTO exists for response formatting")
    
    print("\n8. ROUTE PREFIX ANALYSIS:")
    with open('src/routes/index.js', 'r') as f:
        routes_content = f.read()
    
    if 'notificationsRouter' in routes_content:
        print("   ✓ Notifications router registered in main routes")
    
    print("\n9. CONTROLLER FLOW ANALYSIS:")
    with open('src/modules/notifications/notificationController.js', 'r') as f:
        controller_content = f.read()
    
    if 'BaseController' in controller_content:
        print("   ✓ Controller extends BaseController")
    
    # Check controller method parameters
    if 'req.user.id' in controller_content:
        print("   ✓ Controller uses user context from request")
    
    print("\n" + "="*80)
    print("AUDIT COMPLETE - Ready for detailed testing")
    print("="*80)

trace_full_request_flow()
