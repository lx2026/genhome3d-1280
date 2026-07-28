#!/usr/bin/env python3
"""Build the public GenHome3D-1280 benchmark from the production library.

The script intentionally exports only the completed 2026-07-17 expansion:
64 categories with exactly 20 assets per category. Blender sources and
internal QA evidence remain in the production repository. Web-sized copies of
the authoritative AI reference images are published for side-by-side review.

Model benches are published alongside the catalog. A bench pairs one reference
image with the assets different models built from it; the rebuilds are kept out
of the 20-per-category catalog so the dataset stays one pipeline's output.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
from collections import Counter
from datetime import date
from pathlib import Path


REPOSITORY = "lx2026/genhome3d-1280"
VERSION = "1.0.0"

CATEGORY_PATHS = (
    "seating/armchairs",
    "seating/benches",
    "seating/ottomans",
    "seating/sofas",
    "seating/stools",
    "tables/bar",
    "tables/coffee",
    "tables/console",
    "tables/side",
    "bedroom/cribs",
    "bedroom/headboards",
    "bedroom/mattresses",
    "bedroom/nightstands",
    "bedroom/vanities",
    "cabinets-storage/bookcases",
    "cabinets-storage/cabinets",
    "cabinets-storage/chests",
    "cabinets-storage/credenzas",
    "cabinets-storage/dressers",
    "cabinets-storage/wardrobes",
    "office/desks",
    "office/filing-cabinets",
    "office/office-chairs",
    "entryway/coat-racks",
    "entryway/shoe-storage",
    "entryway/umbrella-stands",
    "kids/seating",
    "kids/storage",
    "kids/tables",
    "outdoor/grills",
    "outdoor/planters",
    "outdoor/seating",
    "outdoor/storage",
    "outdoor/tables",
    "lighting/chandeliers",
    "lighting/floor-lamps",
    "lighting/pendants",
    "lighting/sconces",
    "lighting/table-lamps",
    "lighting/task-lights",
    "bathroom/accessories",
    "bathroom/fixtures",
    "bathroom/storage",
    "decor/art-objects",
    "decor/clocks",
    "decor/mirrors",
    "decor/vases",
    "textiles/blankets",
    "textiles/curtains",
    "textiles/cushions",
    "textiles/rugs",
    "kitchen-cookware/bakeware",
    "kitchen-cookware/cookware",
    "kitchen-cookware/cutting-boards",
    "kitchen-cookware/kettles",
    "kitchen-cookware/mixing-bowls",
    "tableware-utensils/cutlery",
    "tableware-utensils/glassware",
    "tableware-utensils/kitchen-tools",
    "tableware-utensils/knives",
    "tableware-utensils/plates-bowls",
    "tableware-utensils/servingware",
    "appliances/major-appliances",
    "appliances/small-appliances",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        type=Path,
        required=True,
        help="Path to the blender-furniture-gen production repository",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Path to the publication repository",
    )
    parser.add_argument(
        "--skip-previews",
        action="store_true",
        help="Skip WebP preview generation (useful for metadata-only checks)",
    )
    parser.add_argument(
        "--benches-only",
        action="store_true",
        help=(
            "Re-export only the model benches, reusing the published catalog. "
            "Leaves the 1,280-asset catalog, its indexes, and its checksums untouched."
        ),
    )
    return parser.parse_args()


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def recreate_directory(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True)


def make_preview(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        (
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-vf",
            (
                "scale=640:640:force_original_aspect_ratio=decrease,"
                "pad=640:640:(ow-iw)/2:(oh-ih)/2:color=0xeeeae3"
            ),
            "-c:v",
            "mjpeg",
            "-q:v",
            "4",
            str(destination),
        ),
        check=True,
    )


def make_reference(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        (
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-vf",
            "scale=960:960:force_original_aspect_ratio=decrease",
            "-c:v",
            "mjpeg",
            "-q:v",
            "5",
            str(destination),
        ),
        check=True,
    )


def make_bench_image(source: Path, destination: Path) -> None:
    """Write one wide web copy of a bench render, keeping its framing."""

    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        (
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-vf",
            "scale=900:-2:flags=lanczos",
            "-c:v",
            "mjpeg",
            "-q:v",
            "4",
            str(destination),
        ),
        check=True,
    )


def load_bench_registry(source_root: Path):
    """Load and audit the production bench registry with its own validator."""

    tools_root = source_root / "tools"
    module_path = tools_root / "benchmarks.py"
    if not module_path.is_file():
        return None, {}
    if str(tools_root) not in sys.path:
        sys.path.insert(0, str(tools_root))
    specification = importlib.util.spec_from_file_location(
        "production_benchmarks", module_path
    )
    module = importlib.util.module_from_spec(specification)
    # dataclasses resolves annotations through sys.modules, so register first.
    sys.modules[specification.name] = module
    specification.loader.exec_module(module)
    config = module.load_config(source_root)
    registry = module.load_benchmarks(config)
    issues = module.audit_benchmarks(registry.values(), config)
    if issues:
        raise SystemExit("Bench registry audit failed:\n- " + "\n- ".join(issues))
    return module, registry


def category_label(category_path: str) -> str:
    return " / ".join(
        segment.replace("-", " ").title() for segment in category_path.split("/")
    )


def compact_asset_record(
    metadata: dict,
    technical: dict,
    category_path: str,
    usdz_sha256: str,
    public_usdz: Path,
) -> dict:
    identity = metadata["identity"]
    dimensions = metadata["dimensions"]
    geometry = metadata["geometry"]
    production = metadata["production"]
    asset_id = identity["stable_id"]
    slug = identity["slug"]
    relative_usdz = public_usdz.as_posix()
    relative_preview = f"previews/{category_path}/{slug}.jpg"
    relative_reference = f"references/{category_path}/{slug}.jpg"

    return {
        "id": asset_id,
        "slug": slug,
        "title": identity["title"],
        "category": category_path.split("/", 1)[0],
        "subcategory": category_path.split("/", 1)[1],
        "category_path": category_path,
        "category_label": category_label(category_path),
        "tags": identity.get("tags", []),
        "dimensions_m": {
            "width": dimensions["width_m"],
            "depth": dimensions["depth_m"],
            "height": dimensions["height_m"],
        },
        "placement": {
            "type": dimensions.get("placement_type"),
            "origin": dimensions.get("origin"),
            "source_up": dimensions.get("axes", {}).get("source_up"),
            "export_up": dimensions.get("axes", {}).get("export_up"),
            "meters_per_unit": dimensions.get("meters_per_unit", 1.0),
        },
        "geometry": {
            "objects": geometry.get("objects"),
            "vertices": geometry.get("evaluated_vertices"),
            "triangles": geometry.get("evaluated_triangles"),
            "material_slots": metadata.get("materials", {}).get("slot_count"),
        },
        "format": "USDZ",
        "usdz": relative_usdz,
        "preview": relative_preview,
        "reference": relative_reference,
        "download_url": f"https://raw.githubusercontent.com/{REPOSITORY}/main/{relative_usdz}",
        "file_size_bytes": public_usdz.stat().st_size,
        "sha256": usdz_sha256,
        "validation": {
            "technical": technical.get("result"),
            "package_audit": "pass"
            if technical.get("package_audit", {}).get("pass")
            else "fail",
            "bounds": metadata.get("qa", {}).get("bounds_match"),
            "placement": metadata.get("qa", {}).get("placement_plane"),
            "vision_pro_device_review": metadata.get("qa", {}).get(
                "vision_pro_device_review", "pending"
            ),
        },
        "production": {
            "asset_version": identity.get("version", "1.0.0"),
            "export_date": production.get("export_date"),
            "blender_export_version": production.get("blender_export_version"),
        },
    }


def load_bench_audit(source_root: Path) -> tuple[dict, dict[str, list[dict]]]:
    """Read the newest bench visual audit and index its findings by asset."""

    audits = sorted((source_root / "3d-asset-design" / "qa").glob("bench-visual-qc-*.json"))
    if not audits:
        return {}, {}
    audit = load_json(audits[-1])
    findings: dict[str, list[dict]] = {}
    for finding in audit.get("findings", []):
        findings.setdefault(finding["asset_id"], []).append(
            {
                "severity": finding["severity"],
                "category": finding["category"],
                "defect": finding["defect"],
                "fixed": bool(finding.get("fixed")),
            }
        )
    return audit, findings


def incomplete_bench_entries(bench, specs: dict, asset_library: Path) -> list[str]:
    """Return entry IDs whose complete publishable package is not present."""

    incomplete: list[str] = []
    for entry in bench.entries:
        spec = specs.get(entry.asset_id)
        if spec is None:
            incomplete.append(entry.entry_id)
            continue
        asset_dir = asset_library / spec.asset_relative_dir
        required = (
            asset_dir / "metadata" / "asset.json",
            asset_dir / "renders" / "hero.png",
            asset_dir / "renders" / "inspection.png",
        )
        usdz_files = sorted((asset_dir / "exports").glob("*.usdz"))
        if not all(path.is_file() for path in required) or len(usdz_files) != 1:
            incomplete.append(entry.entry_id)
    return incomplete


def benchmark_audit_fields(bench_document: dict) -> dict:
    """Project the current benchmark export into the publication audit."""

    benches = bench_document.get("benches", [])
    return {
        "registered_bench_count": bench_document.get(
            "registered_bench_count", len(benches)
        ),
        "bench_count": len(benches),
        "bench_builds": sum(len(bench["entries"]) for bench in benches),
        "bench_models": sorted(
            {
                entry["model"]
                for bench in benches
                for entry in bench.get("entries", [])
            }
        ),
        "unpublished_benches": bench_document.get("unpublished_benches", []),
        "benches": [
            {
                "id": bench["id"],
                "entries": [entry["model"] for entry in bench["entries"]],
            }
            for bench in benches
        ],
    }


def export_benchmarks(
    source_root: Path,
    output_root: Path,
    module,
    registry: dict,
    catalog_usdz: dict[str, str],
    skip_previews: bool,
) -> dict:
    """Publish every complete registered bench and return the site-facing document."""

    config = module.load_config(source_root)
    specs = module.load_specs(config)
    asset_library = source_root / "3d-asset-design" / "assets"
    audit, audit_findings = load_bench_audit(source_root)
    audited_entries = set(audit.get("audited_entry_ids", []))
    benches: list[dict] = []
    unpublished_benches: list[dict] = []

    for bench in registry.values():
        incomplete_entries = incomplete_bench_entries(bench, specs, asset_library)
        if incomplete_entries:
            unpublished_benches.append(
                {
                    "id": bench.bench_id,
                    "incomplete_entries": incomplete_entries,
                }
            )
            continue

        reference_source = source_root / "3d-asset-design" / bench.reference
        reference_relative = f"references/benchmarks/{bench.bench_id}.jpg"
        make_reference(reference_source, output_root / reference_relative)

        entries: list[dict] = []
        for entry in bench.entries:
            spec = specs[entry.asset_id]
            asset_dir = asset_library / spec.asset_relative_dir
            metadata = load_json(asset_dir / "metadata" / "asset.json")
            # The oldest collections predate the sealed technical-state record.
            # Publish their checks as not run rather than inventing a result.
            technical_path = asset_dir / "qa" / "technical-state.json"
            technical = load_json(technical_path) if technical_path.is_file() else {}
            usdz_files = sorted((asset_dir / "exports").glob("*.usdz"))
            if len(usdz_files) != 1:
                raise SystemExit(f"{entry.asset_id}: expected one USDZ export")

            hero_relative = f"previews/benchmarks/{bench.bench_id}/{entry.entry_id}.jpg"
            inspection_relative = (
                f"previews/benchmarks/{bench.bench_id}/{entry.entry_id}-inspection.jpg"
            )
            if not skip_previews:
                make_bench_image(
                    asset_dir / "renders" / "hero.png", output_root / hero_relative
                )
                make_bench_image(
                    asset_dir / "renders" / "inspection.png",
                    output_root / inspection_relative,
                )

            published_usdz = catalog_usdz.get(entry.asset_id)
            if published_usdz is None:
                published_usdz = (
                    f"assets/benchmarks/{bench.bench_id}/{entry.entry_id}.usdz"
                )
                destination = output_root / published_usdz
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(usdz_files[0], destination)
                usdz_size = destination.stat().st_size
                usdz_digest = sha256(destination)
            else:
                published = output_root / published_usdz
                usdz_size = published.stat().st_size
                usdz_digest = sha256(published)

            identity = metadata["identity"]
            dimensions = metadata["dimensions"]
            geometry = metadata["geometry"]
            provenance = metadata.get("provenance", {})
            quality = metadata.get("qa", {})
            entries.append(
                {
                    "id": entry.entry_id,
                    "model": entry.model,
                    "harness": entry.harness,
                    "built_on": entry.built_on,
                    "method": entry.method,
                    "asset_id": entry.asset_id,
                    "title": identity["title"],
                    "reference_build": entry.asset_id == bench.reference_asset_id,
                    "hero": hero_relative,
                    "inspection": inspection_relative,
                    "dimensions_m": {
                        "width": dimensions["width_m"],
                        "depth": dimensions["depth_m"],
                        "height": dimensions["height_m"],
                    },
                    "geometry": {
                        "objects": geometry.get("objects"),
                        "vertices": geometry.get("evaluated_vertices"),
                        "triangles": geometry.get("evaluated_triangles"),
                        "material_slots": metadata.get("materials", {}).get("slot_count"),
                    },
                    "validation": {
                        "technical": technical.get("result"),
                        "package_audit": (
                            "pass"
                            if technical.get("package_audit", {}).get("pass")
                            else ("fail" if technical else None)
                        ),
                        "bounds": quality.get("bounds_match"),
                        "placement": quality.get("placement_plane"),
                    },
                    "reviewed": entry.entry_id in audited_entries,
                    "findings": audit_findings.get(entry.asset_id, []),
                    "recorded_attribution": {
                        "author": provenance.get("author"),
                        "model": provenance.get("model"),
                        "harness": provenance.get("harness"),
                    },
                    "usdz": published_usdz,
                    "file_size_bytes": usdz_size,
                    "sha256": usdz_digest,
                    "download_url": (
                        f"https://raw.githubusercontent.com/{REPOSITORY}/main/{published_usdz}"
                    ),
                }
            )

        benches.append(
            {
                "id": bench.bench_id,
                "title": bench.title,
                "summary": bench.summary,
                "brief": bench.brief,
                "category_path": bench.category_path,
                "category_label": category_label(bench.category_path),
                "dimensions_m": {
                    "width": bench.dimensions_m[0],
                    "depth": bench.dimensions_m[1],
                    "height": bench.dimensions_m[2],
                },
                "reference": reference_relative,
                "reference_asset_id": bench.reference_asset_id,
                "observations": list(bench.observations),
                "entries": entries,
            }
        )

    return {
        "name": "GenHome3D model benches",
        "version": VERSION,
        "generated_on": date.today().isoformat(),
        "repository": f"https://github.com/{REPOSITORY}",
        "registered_bench_count": len(registry),
        "bench_count": len(benches),
        "unpublished_benches": unpublished_benches,
        "note": (
            "Each bench builds one reference image with more than one model. "
            "Attribution is copied from the metadata recorded at build time, and "
            "review states are reported as the library sealed them."
        ),
        "audit": {
            "audited_on": audit.get("audited_on"),
            "audited_entry_ids": sorted(audited_entries),
            "reviewer": audit.get("reviewer"),
            "method": audit.get("method"),
            "report_url": (
                f"https://github.com/{REPOSITORY}/blob/main/reports/bench-visual-qc.md"
            ),
        }
        if audit
        else None,
        "benches": benches,
    }


def main() -> None:
    args = parse_args()
    source_root = args.source.resolve()
    output_root = args.output.resolve()
    asset_library = source_root / "3d-asset-design" / "assets"

    if not asset_library.is_dir():
        raise SystemExit(f"Asset library not found: {asset_library}")
    if len(CATEGORY_PATHS) != 64:
        raise SystemExit(f"Expected 64 category paths, found {len(CATEGORY_PATHS)}")

    bench_module, bench_registry = load_bench_registry(source_root)
    rebuild_ids = {
        entry.asset_id
        for bench in bench_registry.values()
        for entry in bench.entries
        if entry.asset_id != bench.reference_asset_id
    }
    rebuild_prefixes = tuple(f"{asset_id.lower()}-" for asset_id in sorted(rebuild_ids))

    if args.benches_only:
        if not bench_registry:
            raise SystemExit("No benches are registered in the production library.")
        published = load_json(output_root / "catalog.json")
        bench_document = export_benchmarks(
            source_root,
            output_root,
            bench_module,
            bench_registry,
            {record["id"]: record["usdz"] for record in published["assets"]},
            args.skip_previews,
        )
        (output_root / "benchmarks.json").write_text(
            json.dumps(bench_document, separators=(",", ":")) + "\n", encoding="utf-8"
        )
        publication_audit_path = output_root / "reports" / "publication-audit.json"
        publication_audit = load_json(publication_audit_path)
        publication_audit.update(benchmark_audit_fields(bench_document))
        publication_audit_path.write_text(
            json.dumps(publication_audit, indent=2) + "\n", encoding="utf-8"
        )
        for bench in bench_document["benches"]:
            models = ", ".join(entry["model"] for entry in bench["entries"])
            print(f"Published bench {bench['id']}: {models}.")
        return

    for dirname in ("assets", "metadata", "references"):
        recreate_directory(output_root / dirname)
    if not args.skip_previews:
        recreate_directory(output_root / "previews")
    (output_root / "reports").mkdir(parents=True, exist_ok=True)

    records: list[dict] = []
    checksums: list[str] = []
    failures: list[str] = []
    catalog_usdz: dict[str, str] = {}

    for category_path in CATEGORY_PATHS:
        category_dir = asset_library / category_path
        asset_dirs = sorted(
            path
            for path in category_dir.iterdir()
            if path.is_dir() and not path.name.startswith(rebuild_prefixes)
        )
        if len(asset_dirs) != 20:
            failures.append(
                f"{category_path}: expected 20 asset directories, found {len(asset_dirs)}"
            )
            continue

        for source_asset in asset_dirs:
            metadata_path = source_asset / "metadata" / "asset.json"
            technical_path = source_asset / "qa" / "technical-state.json"
            hero_path = source_asset / "renders" / "hero.png"
            reference_path = source_asset / "references" / "reference.png"
            usdz_files = sorted((source_asset / "exports").glob("*.usdz"))

            required = (metadata_path, technical_path, hero_path, reference_path)
            missing = [str(path) for path in required if not path.is_file()]
            if len(usdz_files) != 1:
                missing.append(
                    f"{source_asset / 'exports'}: expected one USDZ, found {len(usdz_files)}"
                )
            if missing:
                failures.extend(missing)
                continue

            metadata = load_json(metadata_path)
            technical = load_json(technical_path)
            if technical.get("result") != "pass":
                failures.append(f"{source_asset.name}: technical result is not pass")
                continue

            slug = metadata["identity"]["slug"]
            source_usdz = usdz_files[0]
            relative_usdz = Path("assets") / category_path / f"{slug}.usdz"
            public_usdz = output_root / relative_usdz
            public_usdz.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_usdz, public_usdz)

            digest = sha256(public_usdz)
            expected_digest = technical.get("usdz_sha256")
            if expected_digest and digest != expected_digest:
                failures.append(f"{slug}: copied USDZ checksum mismatch")
                continue

            if not args.skip_previews:
                make_preview(
                    hero_path,
                    output_root / "previews" / category_path / f"{slug}.jpg",
                )
            make_reference(
                reference_path,
                output_root / "references" / category_path / f"{slug}.jpg",
            )

            record = compact_asset_record(
                metadata, technical, category_path, digest, relative_usdz
            )
            public_metadata = output_root / "metadata" / category_path / f"{slug}.json"
            public_metadata.parent.mkdir(parents=True, exist_ok=True)
            public_metadata.write_text(
                json.dumps(record, indent=2, sort_keys=False) + "\n", encoding="utf-8"
            )
            records.append(record)
            catalog_usdz[record["id"]] = relative_usdz.as_posix()
            checksums.append(f"{digest}  {relative_usdz.as_posix()}")

    records.sort(key=lambda item: (item["category_path"], item["id"]))
    category_counts = Counter(item["category_path"] for item in records)
    total_bytes = sum(item["file_size_bytes"] for item in records)
    triangle_counts = [item["geometry"]["triangles"] for item in records]

    if len(records) != 1280:
        failures.append(f"Expected 1,280 records, generated {len(records)}")
    for category_path in CATEGORY_PATHS:
        if category_counts[category_path] != 20:
            failures.append(
                f"{category_path}: expected 20 records, generated {category_counts[category_path]}"
            )

    dataset = {
        "name": "GenHome3D-1280",
        "version": VERSION,
        "generated_on": date.today().isoformat(),
        "repository": f"https://github.com/{REPOSITORY}",
        "asset_count": len(records),
        "category_count": len(category_counts),
        "total_usdz_bytes": total_bytes,
        "license": "CC-BY-4.0",
        "formats": ["USDZ", "JSON", "JPEG"],
        "device_review": "Apple Vision Pro on-device review pending",
        "categories": [
            {
                "path": category_path,
                "label": category_label(category_path),
                "count": category_counts[category_path],
            }
            for category_path in CATEGORY_PATHS
        ],
        "assets": records,
    }
    (output_root / "catalog.json").write_text(
        json.dumps(dataset, separators=(",", ":")) + "\n", encoding="utf-8"
    )

    csv_fields = (
        "id",
        "slug",
        "title",
        "category_path",
        "width_m",
        "depth_m",
        "height_m",
        "vertices",
        "triangles",
        "material_slots",
        "file_size_bytes",
        "sha256",
        "usdz",
        "preview",
        "reference",
    )
    with (output_root / "catalog.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=csv_fields)
        writer.writeheader()
        for record in records:
            writer.writerow(
                {
                    "id": record["id"],
                    "slug": record["slug"],
                    "title": record["title"],
                    "category_path": record["category_path"],
                    "width_m": record["dimensions_m"]["width"],
                    "depth_m": record["dimensions_m"]["depth"],
                    "height_m": record["dimensions_m"]["height"],
                    "vertices": record["geometry"]["vertices"],
                    "triangles": record["geometry"]["triangles"],
                    "material_slots": record["geometry"]["material_slots"],
                    "file_size_bytes": record["file_size_bytes"],
                    "sha256": record["sha256"],
                    "usdz": record["usdz"],
                    "preview": record["preview"],
                    "reference": record["reference"],
                }
            )

    (output_root / "checksums.sha256").write_text(
        "\n".join(checksums) + "\n", encoding="utf-8"
    )

    bench_document = {"benches": []}
    if bench_registry:
        bench_document = export_benchmarks(
            source_root,
            output_root,
            bench_module,
            bench_registry,
            catalog_usdz,
            args.skip_previews,
        )
    (output_root / "benchmarks.json").write_text(
        json.dumps(bench_document, separators=(",", ":")) + "\n", encoding="utf-8"
    )

    audit = {
        "dataset": "GenHome3D-1280",
        "version": VERSION,
        "result": "pass" if not failures else "fail",
        "assets": len(records),
        "categories": len(category_counts),
        "technical_passes": sum(
            record["validation"]["technical"] == "pass" for record in records
        ),
        "package_audit_passes": sum(
            record["validation"]["package_audit"] == "pass" for record in records
        ),
        "total_usdz_bytes": total_bytes,
        "triangle_range": {
            "minimum": min(triangle_counts) if triangle_counts else None,
            "maximum": max(triangle_counts) if triangle_counts else None,
        },
        "failures": failures,
    }
    audit.update(benchmark_audit_fields(bench_document))
    (output_root / "reports" / "publication-audit.json").write_text(
        json.dumps(audit, indent=2) + "\n", encoding="utf-8"
    )

    if failures:
        raise SystemExit("Publication audit failed:\n- " + "\n- ".join(failures))

    print(
        f"Published {len(records)} assets across {len(category_counts)} categories "
        f"({total_bytes / 1_000_000_000:.2f} GB USDZ)."
    )
    for bench in bench_document["benches"]:
        models = ", ".join(entry["model"] for entry in bench["entries"])
        print(f"Published bench {bench['id']}: {models}.")


if __name__ == "__main__":
    main()
