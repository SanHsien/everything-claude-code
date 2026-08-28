from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import check_links  # noqa: E402
import check_upstream_updates as checker  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OFFICIAL_REPO = "affaan-m/ECC"
GATED_WORKFLOWS = (
    "release.yml",
    "reusable-release.yml",
    "discussion-announce.yml",
    "release-announce.yml",
    "monthly-metrics.yml",
    "maintenance.yml",
    "supply-chain-watch.yml",
    "generator-generic-ossf-slsa3-publish.yml",
)
UNGATED_WORKFLOWS = (
    "ci.yml",
    "reusable-test.yml",
    "reusable-validate.yml",
    "fork-maintenance.yml",
    "upstream-check.yml",
)


def test_baseline_file_is_valid_and_complete() -> None:
    baseline = checker.load_baseline()

    assert baseline["repo"].endswith("ECC.git")
    assert baseline["branch"] == "main"
    assert len(baseline["reviewed_through"]) == 40
    assert baseline["reviewed_date"] == "2026-08-27"


def test_workflow_is_scheduled_and_fails_on_unreviewed_commits() -> None:
    workflow = (
        ROOT / ".github" / "workflows" / "upstream-check.yml"
    ).read_text(encoding="utf-8")

    assert "schedule:" in workflow
    assert "cron:" in workflow
    assert "workflow_dispatch:" in workflow
    assert "tools/check_upstream_updates.py" in workflow
    assert "fetch-depth: 0" in workflow
    assert "exit 1" in workflow


def test_render_markdown_reports_no_new_commits() -> None:
    baseline = {
        "repo": "https://example.invalid/upstream.git",
        "branch": "main",
        "reviewed_through": "a" * 40,
        "reviewed_date": "2026-08-27",
    }

    report = checker.render_markdown(baseline, [])

    assert "No new upstream commits" in report


def test_render_markdown_surfaces_check_failure() -> None:
    baseline = {
        "repo": "https://example.invalid/upstream.git",
        "branch": "main",
        "reviewed_through": "a" * 40,
        "reviewed_date": "2026-08-27",
    }

    report = checker.render_markdown(baseline, [], error="git fetch failed")

    assert "Check failed" in report
    assert "git fetch failed" in report


def test_load_baseline_rejects_missing_file(tmp_path: Path) -> None:
    with pytest.raises(checker.UpstreamCheckError):
        checker.load_baseline(tmp_path / "nope.json")


def test_baseline_matches_decisions_record() -> None:
    decisions = (ROOT / "docs" / "fork" / "DECISIONS.md").read_text(encoding="utf-8")
    upstream = (ROOT / "docs" / "fork" / "UPSTREAM.md").read_text(encoding="utf-8")
    baseline = json.loads(
        (ROOT / "tools" / "upstream_baseline.json").read_text(encoding="utf-8")
    )

    assert baseline["reviewed_date"] in decisions
    assert baseline["reviewed_through"][:7] in upstream


def test_overlay_markdown_links_resolve() -> None:
    failures = 0
    for path in check_links.iter_documents():
        problems = check_links.check_document(path)
        failures += len(problems)
        for problem in problems:
            print(f"{path}: {problem}")
    assert failures == 0


def test_readme_keeps_upstream_english_product_contract() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")

    assert not (ROOT / "README.en.md").exists()
    assert "SanHsien 維護型 fork" in readme
    assert "SanHsien/everything-claude-code" in readme
    assert "affaan-m/ECC" in readme
    assert "FORK.md" in readme
    assert "REVIEW.md" in readme
    assert "Official sources only" in readme
    assert "chat.promptFiles" in readme
    assert "/plugin marketplace add https://github.com/affaan-m/ECC" in readme
    assert "install.ps1" in readme


def test_link_checker_skips_product_readme_and_scans_review() -> None:
    rels = {path.relative_to(ROOT).as_posix() for path in check_links.iter_documents()}

    assert "README.md" not in rels
    assert "REVIEW.md" in rels
    assert "FORK.md" in rels
    assert "NOTICE.md" in rels
    assert "SECURITY.md" in rels
    assert "CONTRIBUTING.md" in rels
    assert "docs/fork/DECISIONS.md" in rels


def test_missing_relative_rejects_path_escape() -> None:
    problem = check_links._missing_relative(ROOT / "FORK.md", "../outside-the-repo")

    assert problem is not None
    assert "逃出 repo 根目錄" in problem
    assert check_links._missing_relative(ROOT / "FORK.md", "NOTICE.md") is None


def test_review_is_windows_first_record() -> None:
    review = (ROOT / "REVIEW.md").read_text(encoding="utf-8")

    assert "Windows-first" in review
    assert "d8409a4b" in review
    assert "R-01" in review
    assert "R-05" in review
    assert "R-06" in review
    assert "R-07" in review
    assert "SanHsien/everything-claude-code" in review
    assert "affaan-m/ECC" in review


def test_agents_overlay_points_at_fork_rules() -> None:
    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    claude = (ROOT / "CLAUDE.md").read_text(encoding="utf-8")

    assert "SanHsien 維護型 fork overlay" in agents
    assert "FORK.md" in agents
    assert "不要推 `upstream`" in agents
    assert "FORK.md" in claude
    assert "production-ready AI coding plugin" in agents


def test_dangerous_workflows_are_gated_to_upstream() -> None:
    workflows = ROOT / ".github" / "workflows"
    for name in GATED_WORKFLOWS:
        text = (workflows / name).read_text(encoding="utf-8")
        assert "github.repository" in text, name
        assert OFFICIAL_REPO in text, name


def test_product_ci_is_not_official_repo_only() -> None:
    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    assert "windows-latest" in ci
    assert f"github.repository == '{OFFICIAL_REPO}'" not in ci


def test_every_workflow_is_classified_gated_or_ungated() -> None:
    names = {path.name for path in (ROOT / ".github" / "workflows").glob("*.yml")}
    assert names == set(GATED_WORKFLOWS) | set(UNGATED_WORKFLOWS)


def test_ungated_workflows_are_not_official_repo_only() -> None:
    official_guard = f"github.repository == '{OFFICIAL_REPO}'"
    workflows = ROOT / ".github" / "workflows"
    for name in UNGATED_WORKFLOWS:
        text = (workflows / name).read_text(encoding="utf-8")
        assert official_guard not in text, name


def test_security_and_contributing_name_the_fork() -> None:
    security = (ROOT / "SECURITY.md").read_text(encoding="utf-8")
    contributing = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")

    assert "SanHsien/everything-claude-code" in security
    assert "SanHsien/everything-claude-code" in contributing
    assert "FORK.md" in security
    assert "FORK.md" in contributing
    assert "affaan-m/ECC/security/advisories/new" in security
    assert "gh repo fork affaan-m/ECC" in contributing


def test_installers_bootstrap_with_ignore_scripts() -> None:
    ps1 = (ROOT / "install.ps1").read_text(encoding="utf-8")
    sh = (ROOT / "install.sh").read_text(encoding="utf-8")
    expected = "npm install --ignore-scripts --no-audit --no-fund --loglevel=error"

    assert expected in ps1
    assert expected in sh


def test_fork_workflows_use_python_314() -> None:
    for name in ("fork-maintenance.yml", "upstream-check.yml"):
        text = (ROOT / ".github" / "workflows" / name).read_text(encoding="utf-8")
        assert 'python-version: "3.14"' in text, name
        assert 'python-version: "3.11"' not in text, name
