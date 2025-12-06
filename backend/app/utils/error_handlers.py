from fastapi import HTTPException, status
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict = {}


def raise_not_found(resource: str, resource_id: str):
    """Raise 404 error for missing resource"""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "code": "NOT_FOUND",
            "message": f"{resource} not found",
            "details": {"resource": resource, "id": resource_id},
        },
    )


def raise_validation_error(field: str, value, message: str):
    """Raise 422 validation error"""
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "code": "VALIDATION_ERROR",
            "message": message,
            "details": {"field": field, "value": value},
        },
    )


def raise_evaluation_failed(message: str, details: dict = None):
    """Raise 500 error for evaluation failures"""
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={
            "code": "EVALUATION_FAILED",
            "message": message,
            "details": details or {},
        },
    )
