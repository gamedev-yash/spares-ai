from app.ai.pr_quality import check_pr_quality
from app.services import quality_validation


def test_vague_description_detected():
    issues = quality_validation.check_line("misc parts", service_code=None, material_group="Bearings")
    assert "VAGUE_DESCRIPTION" in issues


def test_missing_service_code_detected_for_service_line():
    issues = quality_validation.check_line("Calibration service for flow meter", service_code=None, material_group="Services")
    assert "MISSING_SERVICE_CODE" in issues


def test_clean_line_has_no_issues():
    issues = quality_validation.check_line("Deep Groove Ball Bearing 6205-2RS, 25mm bore", service_code=None, material_group="Bearings")
    assert issues == []


def test_duplicate_lines_detected():
    duplicates = quality_validation.check_duplicates([(1, 100), (2, 200), (3, 100)])
    assert duplicates == {1, 3}


def test_check_pr_quality_flags_and_explains():
    result = check_pr_quality(
        "PR-TEST-001",
        [
            {"id": 1, "material_id": 100, "description": "spares as required", "service_code": None, "material_group": "Bearings"},
            {"id": 2, "material_id": 200, "description": "Deep Groove Ball Bearing 6205-2RS, 25mm bore", "service_code": None, "material_group": "Bearings"},
        ],
    )
    assert result["has_issues"] is True
    assert len(result["issues"]) == 1
    assert result["issues"][0]["line_item_id"] == 1
    assert "Demo mode" in result["explanation"]


def test_check_pr_quality_no_issues():
    result = check_pr_quality(
        "PR-TEST-002",
        [{"id": 1, "material_id": 100, "description": "Deep Groove Ball Bearing 6205-2RS, 25mm bore", "service_code": None, "material_group": "Bearings"}],
    )
    assert result["has_issues"] is False
    assert result["issues"] == []
