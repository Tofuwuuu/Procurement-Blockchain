"""
Purchase Request Workflow Configuration

This module defines the multi-level approval workflow rules for Purchase Requests.
It maps roles to approval stages and determines which PRs require which approval levels.
"""

from typing import List, Dict, Optional
from enum import Enum

# ============================================================================
# WORKFLOW STATES
# ============================================================================

class PRStatus(str, Enum):
    """Purchase Request Status Enum"""
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    UNDER_REVIEW = "Under Review"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    CANCELLED = "Cancelled"

class ApprovalStage(str, Enum):
    """Approval Stage Enum"""
    SUPERVISOR = "supervisor"
    MANAGER = "manager"
    FINANCE = "finance"
    DONE = "done"

# ============================================================================
# EXISTING ROLES IN SYSTEM
# ============================================================================

class UserRole(str, Enum):
    """User Roles in the System"""
    ADMIN = "admin"
    PROCUREMENT = "procurement"
    VALIDATOR = "validator"
    FINANCE = "finance"
    AUDITOR = "auditor"
    SUPPLIER = "supplier"
    CANVASSER = "canvasser"
    EMPLOYEE = "employee"  # Default role

# ============================================================================
# APPROVAL STAGE MAPPING
# ============================================================================

# Map approval stages to roles that can approve at that stage
APPROVAL_STAGE_ROLES: Dict[ApprovalStage, List[str]] = {
    ApprovalStage.SUPERVISOR: [
        UserRole.PROCUREMENT.value,
        UserRole.VALIDATOR.value,
        UserRole.ADMIN.value
    ],
    ApprovalStage.MANAGER: [
        UserRole.VALIDATOR.value,
        UserRole.ADMIN.value
    ],
    ApprovalStage.FINANCE: [
        UserRole.FINANCE.value,
        UserRole.ADMIN.value
    ]
}

# ============================================================================
# APPROVAL MATRIX
# ============================================================================

class ApprovalMatrix:
    """
    Determines which approval stages are required based on PR characteristics.
    """
    
    # Amount thresholds (in PHP)
    LOW_AMOUNT_THRESHOLD = 10_000.00      # Below this: Supervisor only
    MEDIUM_AMOUNT_THRESHOLD = 50_000.00   # Below this: Supervisor + Manager
    HIGH_AMOUNT_THRESHOLD = 100_000.00    # Below this: Supervisor + Manager + Finance
    # Above HIGH_AMOUNT_THRESHOLD: All stages required
    
    @staticmethod
    def get_required_stages(
        total_amount: float,
        department: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[ApprovalStage]:
        """
        Determine required approval stages based on PR characteristics.
        
        Args:
            total_amount: Total amount of the PR
            department: Department creating the PR (optional, for future use)
            category: PR category (optional, for future use)
        
        Returns:
            List of required approval stages in order
        """
        stages = []
        
        # Always require supervisor approval first
        stages.append(ApprovalStage.SUPERVISOR)
        
        # Add manager approval based on amount
        if total_amount >= ApprovalMatrix.LOW_AMOUNT_THRESHOLD:
            stages.append(ApprovalStage.MANAGER)
        
        # Add finance approval for higher amounts
        if total_amount >= ApprovalMatrix.MEDIUM_AMOUNT_THRESHOLD:
            stages.append(ApprovalStage.FINANCE)
        
        # For very high amounts, ensure all stages are required
        if total_amount >= ApprovalMatrix.HIGH_AMOUNT_THRESHOLD:
            # Already have all stages, but ensure finance is included
            if ApprovalStage.FINANCE not in stages:
                stages.append(ApprovalStage.FINANCE)
        
        return stages
    
    @staticmethod
    def get_stage_name(stage: ApprovalStage) -> str:
        """Get human-readable name for approval stage"""
        names = {
            ApprovalStage.SUPERVISOR: "Supervisor Approval",
            ApprovalStage.MANAGER: "Manager Approval",
            ApprovalStage.FINANCE: "Finance Approval",
            ApprovalStage.DONE: "Completed"
        }
        return names.get(stage, stage.value.title())

# ============================================================================
# STATE TRANSITIONS
# ============================================================================

class WorkflowTransitions:
    """
    Defines who can perform which state transitions
    """
    
    # Who can create PRs (all authenticated users)
    CAN_CREATE = [
        UserRole.ADMIN.value,
        UserRole.PROCUREMENT.value,
        UserRole.EMPLOYEE.value,
        UserRole.VALIDATOR.value,
        UserRole.FINANCE.value
    ]
    
    # Who can submit PRs (creator or admin)
    CAN_SUBMIT = [
        UserRole.ADMIN.value,
        UserRole.PROCUREMENT.value,
        UserRole.EMPLOYEE.value,
        UserRole.VALIDATOR.value,
        UserRole.FINANCE.value
    ]
    
    # Who can approve at each stage (defined in APPROVAL_STAGE_ROLES)
    
    # Who can reject (any approver at any stage)
    CAN_REJECT = [
        UserRole.ADMIN.value,
        UserRole.PROCUREMENT.value,
        UserRole.VALIDATOR.value,
        UserRole.FINANCE.value
    ]
    
    # Who can cancel (creator or admin)
    CAN_CANCEL = [
        UserRole.ADMIN.value,
        UserRole.PROCUREMENT.value,
        UserRole.EMPLOYEE.value
    ]
    
    # Who can add comments (any authenticated user)
    CAN_COMMENT = [
        UserRole.ADMIN.value,
        UserRole.PROCUREMENT.value,
        UserRole.VALIDATOR.value,
        UserRole.FINANCE.value,
        UserRole.EMPLOYEE.value,
        UserRole.AUDITOR.value
    ]
    
    @staticmethod
    def can_user_approve_at_stage(user_role: str, stage: ApprovalStage) -> bool:
        """Check if user role can approve at given stage"""
        allowed_roles = APPROVAL_STAGE_ROLES.get(stage, [])
        return user_role.lower() in [r.lower() for r in allowed_roles]
    
    @staticmethod
    def can_user_submit(user_role: str) -> bool:
        """Check if user role can submit PRs"""
        return user_role.lower() in [r.lower() for r in WorkflowTransitions.CAN_SUBMIT]
    
    @staticmethod
    def can_user_reject(user_role: str) -> bool:
        """Check if user role can reject PRs"""
        return user_role.lower() in [r.lower() for r in WorkflowTransitions.CAN_REJECT]
    
    @staticmethod
    def can_user_cancel(user_role: str) -> bool:
        """Check if user role can cancel PRs"""
        return user_role.lower() in [r.lower() for r in WorkflowTransitions.CAN_CANCEL]
    
    @staticmethod
    def can_user_comment(user_role: str) -> bool:
        """Check if user role can add comments"""
        return user_role.lower() in [r.lower() for r in WorkflowTransitions.CAN_COMMENT]

# ============================================================================
# WORKFLOW RULES SUMMARY
# ============================================================================

WORKFLOW_RULES = {
    "states": {
        "initial": PRStatus.DRAFT.value,
        "final": [PRStatus.APPROVED.value, PRStatus.REJECTED.value, PRStatus.CANCELLED.value],
        "all": [s.value for s in PRStatus]
    },
    "transitions": {
        "creator_to_submitted": {
            "from": PRStatus.DRAFT.value,
            "to": PRStatus.SUBMITTED.value,
            "allowed_roles": WorkflowTransitions.CAN_SUBMIT
        },
        "approve": {
            "from": [PRStatus.SUBMITTED.value, PRStatus.UNDER_REVIEW.value],
            "to": PRStatus.UNDER_REVIEW.value,  # Moves to next stage or Approved
            "allowed_roles": "stage_dependent"  # Check APPROVAL_STAGE_ROLES
        },
        "reject": {
            "from": [PRStatus.SUBMITTED.value, PRStatus.UNDER_REVIEW.value],
            "to": PRStatus.REJECTED.value,
            "allowed_roles": WorkflowTransitions.CAN_REJECT,
            "requires_reason": True
        },
        "cancel": {
            "from": [PRStatus.DRAFT.value, PRStatus.SUBMITTED.value],
            "to": PRStatus.CANCELLED.value,
            "allowed_roles": WorkflowTransitions.CAN_CANCEL
        }
    },
    "approval_stages": {
        "order": [
            ApprovalStage.SUPERVISOR.value,
            ApprovalStage.MANAGER.value,
            ApprovalStage.FINANCE.value
        ],
        "roles": {
            ApprovalStage.SUPERVISOR.value: APPROVAL_STAGE_ROLES[ApprovalStage.SUPERVISOR],
            ApprovalStage.MANAGER.value: APPROVAL_STAGE_ROLES[ApprovalStage.MANAGER],
            ApprovalStage.FINANCE.value: APPROVAL_STAGE_ROLES[ApprovalStage.FINANCE]
        }
    },
    "amount_thresholds": {
        "low": ApprovalMatrix.LOW_AMOUNT_THRESHOLD,
        "medium": ApprovalMatrix.MEDIUM_AMOUNT_THRESHOLD,
        "high": ApprovalMatrix.HIGH_AMOUNT_THRESHOLD
    }
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_next_stage(current_stage: Optional[ApprovalStage], required_stages: List[ApprovalStage]) -> Optional[ApprovalStage]:
    """
    Get the next approval stage after current stage.
    
    Args:
        current_stage: Current approval stage (None if just submitted)
        required_stages: List of all required stages for this PR
    
    Returns:
        Next stage or None if all stages completed
    """
    if not required_stages:
        return None
    
    if current_stage is None:
        # First stage
        return required_stages[0] if required_stages else None
    
    try:
        current_index = required_stages.index(current_stage)
        if current_index + 1 < len(required_stages):
            return required_stages[current_index + 1]
    except ValueError:
        # Current stage not in required stages (shouldn't happen)
        pass
    
    return None  # All stages completed

def is_final_stage(stage: ApprovalStage, required_stages: List[ApprovalStage]) -> bool:
    """Check if stage is the final required stage"""
    if not required_stages:
        return True
    return stage == required_stages[-1]

def get_workflow_summary() -> Dict:
    """Get a summary of workflow configuration for API/documentation"""
    return {
        "roles": {
            stage.value: {
                "name": ApprovalMatrix.get_stage_name(stage),
                "allowed_roles": roles
            }
            for stage, roles in APPROVAL_STAGE_ROLES.items()
        },
        "amount_thresholds": {
            "low": ApprovalMatrix.LOW_AMOUNT_THRESHOLD,
            "medium": ApprovalMatrix.MEDIUM_AMOUNT_THRESHOLD,
            "high": ApprovalMatrix.HIGH_AMOUNT_THRESHOLD
        },
        "rules": WORKFLOW_RULES
    }
