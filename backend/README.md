# AI Bias & Heuristics Diagnostic Tool - Backend API

A RESTful API that simulates heuristic bias detection in AI systems, manages evaluation runs, calculates statistical baselines, and generates actionable recommendations.

## Features

- **Heuristic Bias Detection**: Simulates detection of 5 types of cognitive biases
  - Anchoring Bias
  - Loss Aversion
  - Confirmation Bias
  - Sunk Cost Fallacy
  - Availability Heuristic

- **Statistical Analysis**: Calculates confidence levels, severity scores, and zone status
- **Longitudinal Tracking**: Generates 30-day historical trends with drift detection
- **Recommendation Engine**: Provides prioritized, actionable mitigation strategies
- **Dual-Mode Reporting**: Technical and simplified explanations

## Tech Stack

- **Framework**: FastAPI 0.115.0
- **Database**: SQLite (via SQLAlchemy 2.0)
- **Validation**: Pydantic 2.9
- **Analytics**: Pandas, NumPy
- **Server**: Uvicorn (ASGI)

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app initialization
│   ├── config.py            # Settings and environment variables
│   ├── database.py          # SQLAlchemy setup
│   ├── models/              # Database models
│   │   ├── evaluation.py
│   │   ├── heuristic.py
│   │   ├── baseline.py
│   │   └── recommendation.py
│   ├── schemas/             # Pydantic schemas
│   │   ├── evaluation.py
│   │   ├── heuristic.py
│   │   ├── baseline.py
│   │   ├── recommendation.py
│   │   └── trend.py
│   ├── routers/             # API route handlers
│   │   ├── evaluations.py
│   │   ├── heuristics.py
│   │   ├── baselines.py
│   │   ├── recommendations.py
│   │   └── trends.py
│   ├── services/            # Business logic
│   │   ├── heuristic_detector.py
│   │   ├── statistical_analyzer.py
│   │   └── recommendation_generator.py
│   └── utils/               # Helper functions
│       ├── calculations.py
│       └── error_handlers.py
├── requirements.txt
├── .env.example
└── README.md
```

## Installation

### Prerequisites

- Python 3.9 or higher
- pip or virtualenv

### Setup Steps

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Create virtual environment** (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment** (optional):
   ```bash
   cp .env.example .env
   # Edit .env file with your settings
   ```

5. **Initialize database**:
   The database will be automatically created on first run. To manually initialize:
   ```bash
   python -c "from app.database import init_db; init_db()"
   ```

## Running the Server

### Development Mode

```bash
uvicorn app.main:app --reload --port 8000
```

The `--reload` flag enables auto-reload on code changes.

### Production Mode

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Access Points

- **API Base URL**: http://localhost:8000
- **Interactive API Docs**: http://localhost:8000/docs (Swagger UI)
- **Alternative Docs**: http://localhost:8000/redoc (ReDoc)
- **Health Check**: http://localhost:8000/health

## API Endpoints

### Evaluation Management

#### Create Evaluation
```http
POST /api/evaluations
Content-Type: application/json

{
  "ai_system_name": "GPT-4 Customer Support Bot",
  "heuristic_types": ["anchoring", "loss_aversion", "confirmation_bias"],
  "iteration_count": 100
}
```

**Response**: 201 Created
```json
{
  "id": "uuid",
  "ai_system_name": "GPT-4 Customer Support Bot",
  "heuristic_types": ["anchoring", "loss_aversion", "confirmation_bias"],
  "iteration_count": 100,
  "status": "pending",
  "created_at": "2025-12-06T10:00:00",
  "completed_at": null,
  "overall_score": null,
  "zone_status": null
}
```

#### Execute Evaluation
```http
POST /api/evaluations/{evaluation_id}/execute
```

**Response**: 200 OK
```json
{
  "evaluation_id": "uuid",
  "status": "completed",
  "overall_score": 65.5,
  "zone_status": "yellow",
  "findings_count": 3,
  "message": "Evaluation completed successfully"
}
```

#### List Evaluations
```http
GET /api/evaluations?limit=10&offset=0
```

#### Get Evaluation
```http
GET /api/evaluations/{evaluation_id}
```

#### Delete Evaluation
```http
DELETE /api/evaluations/{evaluation_id}
```

### Heuristic Analysis

#### Get All Findings
```http
GET /api/evaluations/{evaluation_id}/heuristics
```

**Response**: 200 OK
```json
[
  {
    "id": "uuid",
    "evaluation_id": "uuid",
    "heuristic_type": "anchoring",
    "severity": "high",
    "severity_score": 72.5,
    "confidence_level": 0.85,
    "detection_count": 85,
    "example_instances": [
      "System over-weighted first piece of information by 45%",
      "Initial anchor caused 38% response variance"
    ],
    "pattern_description": "System over-weighted first piece of information by 42.3% on average",
    "created_at": "2025-12-06T10:05:00"
  }
]
```

#### Get Specific Heuristic
```http
GET /api/evaluations/{evaluation_id}/heuristics/{heuristic_type}
```

### Longitudinal Tracking

#### Create Baseline
```http
POST /api/baselines
Content-Type: application/json

{
  "name": "Production Baseline Q4 2025",
  "evaluation_id": "uuid",
  "zone_thresholds": {
    "green_zone_max": 75.0,
    "yellow_zone_max": 85.0
  }
}
```

#### Get Baseline
```http
GET /api/baselines/{baseline_id}
```

#### Get Trends
```http
GET /api/evaluations/{evaluation_id}/trends
```

**Response**: 200 OK
```json
{
  "evaluation_id": "uuid",
  "data_points": [
    {
      "timestamp": "2025-11-06T00:00:00",
      "score": 70.2,
      "zone": "green"
    },
    {
      "timestamp": "2025-11-07T00:00:00",
      "score": 72.1,
      "zone": "green"
    }
  ],
  "current_zone": "yellow",
  "drift_alert": true,
  "drift_message": "Bias metrics increasing by 12.3% over last 7 days"
}
```

### Recommendations

#### Get Recommendations
```http
GET /api/evaluations/{evaluation_id}/recommendations?mode=technical
```

**Query Parameters**:
- `mode`: `technical` or `simplified` (default: `technical`)

**Response**: 200 OK
```json
[
  {
    "id": "uuid",
    "evaluation_id": "uuid",
    "heuristic_type": "anchoring",
    "priority": 9,
    "action_title": "Implement multi-perspective prompting",
    "technical_description": "Restructure prompts to present multiple baseline values...",
    "simplified_description": "Present multiple starting points to prevent over-reliance...",
    "estimated_impact": "high",
    "implementation_difficulty": "easy",
    "created_at": "2025-12-06T10:05:00"
  }
]
```

#### Get Single Recommendation
```http
GET /api/recommendations/{recommendation_id}
```

## Configuration

Edit `.env` file to customize settings:

```env
# Database
DATABASE_URL=sqlite:///./bias_tool.db

# API
API_HOST=0.0.0.0
API_PORT=8000

# CORS (comma-separated origins)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080

# Application
SESSION_DURATION=3600
MAX_ITERATIONS=1000
MIN_ITERATIONS=10
DEBUG=True
```

## Error Handling

All errors follow a standard format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "field_name",
      "value": "invalid_value"
    }
  }
}
```

### Error Codes

- `VALIDATION_ERROR` (422): Invalid request data
- `NOT_FOUND` (404): Resource doesn't exist
- `EVALUATION_FAILED` (500): Analysis simulation error
- `INTERNAL_ERROR` (500): Unexpected server error

## Heuristic Detection Logic

### Anchoring Bias
- **Test**: Present identical scenarios with different initial values
- **Threshold**: Variance > 30% flagged as detected
- **Severity**: Based on divergence magnitude

### Loss Aversion
- **Test**: Present equivalent gain/loss scenarios
- **Threshold**: Loss weight > 2x gain weight
- **Severity**: Based on sensitivity ratio

### Confirmation Bias
- **Test**: Present contradicting evidence
- **Threshold**: Dismissal rate > 60%
- **Severity**: Based on evidence dismissal rate

### Sunk Cost Fallacy
- **Test**: Scenarios with prior investment
- **Threshold**: Influence > 50%
- **Severity**: Based on influence magnitude

### Availability Heuristic
- **Test**: Rare vs common event scenarios
- **Threshold**: Estimation error > 40%
- **Severity**: Based on bias magnitude

## Statistical Calculations

### Confidence Level
```python
confidence = (detection_count / total_iterations) * (1 - (1 / sqrt(total_iterations)))
# Capped at 0.99
```

### Zone Status
- **Green Zone**: score ≤ baseline_mean + (0.5 × std_dev)
- **Yellow Zone**: score ≤ baseline_mean + (1.5 × std_dev)
- **Red Zone**: score > yellow_zone_max

### Priority Score
```python
priority = (severity_score × 0.6) + (confidence_level × 30) + (impact_score × 0.1)
# Normalized to 1-10 scale
```

## Development

### Database Schema

The SQLite database includes:
- `evaluations`: Main evaluation records
- `heuristic_findings`: Detected bias findings
- `baselines`: Statistical baseline configurations
- `recommendations`: Mitigation recommendations

### Adding New Heuristic Types

1. Add enum value to `models/heuristic.py`
2. Implement detector method in `services/heuristic_detector.py`
3. Add severity thresholds to `utils/calculations.py`
4. Add recommendation templates to `services/recommendation_generator.py`

## Performance

- **API Response Time**: < 200ms for GET requests
- **Evaluation Execution**: 2-5 seconds for 30-1000 iterations
- **Concurrent Runs**: Supports 10+ concurrent evaluations
- **Database Capacity**: 1000+ evaluation records

## Limitations (MVP)

This is a prototype/demo backend with simulated detection logic:

- ❌ No real ML model integration
- ❌ No user authentication
- ❌ No background job queue
- ❌ No caching layer
- ❌ No real-time WebSocket updates
- ❌ SQLite only (not production-ready for scale)

**Production Recommendations**:
- Integrate actual AI model analysis
- Add PostgreSQL database
- Implement Redis caching
- Add JWT authentication
- Use Celery for background jobs
- Add comprehensive test suite

## Troubleshooting

### Database Issues
```bash
# Delete and recreate database
rm bias_tool.db
python -c "from app.database import init_db; init_db()"
```

### CORS Errors
Check that your frontend origin is listed in `CORS_ORIGINS` in `.env`

### Import Errors
Ensure you're in the backend directory and virtual environment is activated:
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
```

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [project-repo]/issues
- Documentation: http://localhost:8000/docs
