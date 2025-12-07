from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models.evaluation import Evaluation
from ..models.heuristic import HeuristicFinding
from ..schemas.heuristic import HeuristicFindingResponse
from ..utils.error_handlers import raise_not_found
from ..auth import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/api/evaluations", tags=["heuristics"])


@router.get("/{evaluation_id}/heuristics", response_model=List[HeuristicFindingResponse])
def get_heuristics(
    evaluation_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all heuristic findings for an evaluation.
    """
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()

    if not evaluation:
        raise_not_found("Evaluation", evaluation_id)

    findings = db.query(HeuristicFinding).filter(
        HeuristicFinding.evaluation_id == evaluation_id
    ).all()

    return findings


@router.get("/{evaluation_id}/heuristics/{heuristic_type}", response_model=HeuristicFindingResponse)
def get_heuristic_by_type(
    evaluation_id: str,
    heuristic_type: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed analysis for a specific heuristic type.
    """
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()

    if not evaluation:
        raise_not_found("Evaluation", evaluation_id)

    finding = db.query(HeuristicFinding).filter(
        HeuristicFinding.evaluation_id == evaluation_id,
        HeuristicFinding.heuristic_type == heuristic_type
    ).first()

    if not finding:
        raise_not_found("HeuristicFinding", f"{evaluation_id}/{heuristic_type}")

    return finding
