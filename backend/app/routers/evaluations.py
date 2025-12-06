from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from ..database import get_db, SessionLocal
from ..models.evaluation import Evaluation, EvaluationStatus
from ..models.heuristic import HeuristicFinding
from ..models.recommendation import Recommendation
from ..schemas.evaluation import (
    EvaluationCreate,
    EvaluationResponse,
    EvaluationList,
    ExecutionResponse,
)
from ..services.heuristic_detector import HeuristicDetector
from ..services.statistical_analyzer import StatisticalAnalyzer
from ..services.recommendation_generator import RecommendationGenerator
from ..utils.error_handlers import raise_not_found, raise_validation_error
from ..utils.calculations import calculate_zone_status

router = APIRouter(prefix="/api/evaluations", tags=["evaluations"])


@router.post("", response_model=EvaluationResponse, status_code=201)
def create_evaluation(
    evaluation: EvaluationCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new evaluation run.
    """
    # Validate iteration count
    if not (10 <= evaluation.iteration_count <= 1000):
        raise_validation_error(
            "iteration_count",
            evaluation.iteration_count,
            "Iteration count must be between 10 and 1000"
        )

    # Create evaluation
    db_evaluation = Evaluation(
        ai_system_name=evaluation.ai_system_name,
        heuristic_types=evaluation.heuristic_types,
        iteration_count=evaluation.iteration_count,
        status=EvaluationStatus.PENDING,
    )

    db.add(db_evaluation)
    db.commit()
    db.refresh(db_evaluation)

    return db_evaluation


@router.get("", response_model=EvaluationList)
def list_evaluations(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    List all evaluations with pagination.
    """
    query = db.query(Evaluation).order_by(Evaluation.created_at.desc())
    total = query.count()
    items = query.limit(limit).offset(offset).all()

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{evaluation_id}", response_model=EvaluationResponse)
def get_evaluation(
    evaluation_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve evaluation details by ID.
    """
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()

    if not evaluation:
        raise_not_found("Evaluation", evaluation_id)

    return evaluation


def _process_evaluation(evaluation_id: str):
    """
    Background task to process an evaluation asynchronously.
    """
    db = SessionLocal()
    try:
        evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
        if not evaluation:
            return

        # Run heuristic detection
        findings = HeuristicDetector.run_detection(
            evaluation.heuristic_types,
            evaluation.iteration_count
        )

        # Save findings to database
        for finding in findings:
            db_finding = HeuristicFinding(
                evaluation_id=evaluation.id,
                heuristic_type=finding["heuristic_type"],
                severity=finding["severity"],
                severity_score=finding["severity_score"],
                confidence_level=finding["confidence_level"],
                detection_count=finding["detection_count"],
                example_instances=finding["example_instances"],
                pattern_description=finding["pattern_description"],
            )
            db.add(db_finding)

        # Calculate overall score
        overall_score = StatisticalAnalyzer.calculate_overall_score(findings)
        baseline = StatisticalAnalyzer.get_default_baseline()
        zone_status = calculate_zone_status(overall_score, baseline)

        # Generate and save recommendations
        recommendations = RecommendationGenerator.generate_recommendations(findings)
        for rec in recommendations:
            db_rec = Recommendation(
                evaluation_id=evaluation.id,
                heuristic_type=rec["heuristic_type"],
                priority=rec["priority"],
                action_title=rec["action_title"],
                technical_description=rec["technical_description"],
                simplified_description=rec["simplified_description"],
                estimated_impact=rec["estimated_impact"],
                implementation_difficulty=rec["implementation_difficulty"],
            )
            db.add(db_rec)

        # Update evaluation
        evaluation.status = EvaluationStatus.COMPLETED
        evaluation.completed_at = datetime.utcnow()
        evaluation.overall_score = overall_score
        evaluation.zone_status = zone_status

        db.commit()

    except Exception:
        evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
        if evaluation:
            evaluation.status = EvaluationStatus.FAILED
            db.commit()
    finally:
        db.close()


@router.post("/{evaluation_id}/execute", response_model=ExecutionResponse)
def execute_evaluation(
    evaluation_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Run the heuristic analysis simulation for an evaluation.
    Processing happens asynchronously in the background.
    """
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()

    if not evaluation:
        raise_not_found("Evaluation", evaluation_id)

    if evaluation.status != EvaluationStatus.PENDING:
        raise_validation_error(
            "status",
            evaluation.status,
            f"Evaluation already {evaluation.status.value}"
        )

    # Update status to running
    evaluation.status = EvaluationStatus.RUNNING
    db.commit()

    # Queue background task for async processing
    background_tasks.add_task(_process_evaluation, evaluation_id)

    return {
        "evaluation_id": evaluation.id,
        "status": evaluation.status,
        "overall_score": None,
        "zone_status": None,
        "findings_count": 0,
        "message": "Evaluation started - processing in background",
    }


@router.delete("/{evaluation_id}", status_code=204)
def delete_evaluation(
    evaluation_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete an evaluation and all related data.
    """
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()

    if not evaluation:
        raise_not_found("Evaluation", evaluation_id)

    db.delete(evaluation)
    db.commit()

    return None
