#!/usr/bin/env python3
"""Verify the Astra publication without changing packages, images or manifests.

Requires Pillow (also used by the importer). Supply --source to compare against
sealed production outputs. --verify-image-encoding additionally reproduces the
published JPEG transformation for every new baseline and Astra image. The public
report contains repository-relative paths and hashes, never local source paths.
"""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
import sys

import PIL
from PIL import Image

BASELINE = '6825e1f299e74d32fe9b6133d8dcd2aed21c8c55'
RUN = 'astra-2026-09-26'
RAW = 'https://raw.githubusercontent.com/lx2026/genhome3d-1280/main/'
MODEL_COUNTS = {'GPT-5.6 Sol': 1319, 'GPT-6 Astra': 1280, 'Claude Opus 5': 241, 'Claude Fable 5': 14}
PROTECTED = ('catalog.json', 'catalog.csv', 'checksums.sha256', 'reports/publication-audit.json', 'reports/bench-visual-qc.md')


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


@lru_cache(maxsize=None)
def hashes(path):
    """Read once for both a Git blob identity and a package SHA-256."""
    size = path.stat().st_size
    blob = hashlib.sha1(f'blob {size}\0'.encode())
    sha = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            blob.update(chunk)
            sha.update(chunk)
    return size, sha.hexdigest(), blob.hexdigest()


@lru_cache(maxsize=None)
def image_info(path):
    with Image.open(path) as im:
        value = {'width': im.width, 'height': im.height, 'format': im.format}
        im.verify()
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--publication', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--source', type=Path, help='Optional frozen production repository; never included in public report.')
    parser.add_argument('--baseline-commit', default=BASELINE)
    parser.add_argument('--output', type=Path, default=Path('reports/astra-publication-audit.json'))
    parser.add_argument('--jobs', type=int, default=4)
    parser.add_argument('--verify-image-encoding', action='store_true')
    args = parser.parse_args()
    root = args.publication.resolve()
    source = args.source.resolve() if args.source else None
    failures = []
    counts = Counter()
    source_bindings = []

    def check(ok, code, subject):
        if not ok:
            failures.append({'code': code, 'subject': subject})
        return bool(ok)

    def public_path(value):
        path = PurePosixPath(value)
        if path.is_absolute() or '..' in path.parts or not value or '\\' in value:
            raise ValueError('Invalid repository-relative path')
        resolved = (root / value).resolve()
        if not resolved.is_relative_to(root):
            raise ValueError('Public path leaves repository')
        return resolved

    def guarded(label, function, *arguments):
        try:
            return function(*arguments)
        except Exception as exc:
            # Exception strings may contain private filesystem paths.
            failures.append({'code': 'unreadable_or_invalid_input', 'subject': label, 'error_type': type(exc).__name__})
            return None

    def git(*arguments):
        return subprocess.check_output(['git', *arguments], cwd=root, stderr=subprocess.DEVNULL)

    old = json.loads(git('show', f'{args.baseline_commit}:benchmarks.json'))
    current = read(root / 'benchmarks.json')
    catalog = read(root / 'catalog.json')
    old_benches = {b['id']: b for b in old['benches']}
    benches = {b['id']: b for b in current['benches']}
    check(len(benches) == len(current['benches']) == 1319, 'comparison_count_or_duplicate', 'benchmarks.json')
    check(current['bench_count'] == len(benches), 'declared_comparison_count', 'benchmarks.json')
    catalog_by_id = {a['id']: a for a in catalog['assets']}
    check(len(catalog_by_id) == len(catalog['assets']) == 1280, 'baseline_catalog_count_or_duplicate', 'catalog.json')
    entries = [(b, e) for b in current['benches'] for e in b['entries']]
    check(len(entries) == 2854, 'build_count', 'benchmarks.json')
    model_counts = dict(Counter(e['model'] for _, e in entries))
    check(model_counts == MODEL_COUNTS, 'model_build_counts', 'benchmarks.json')

    for bid, previous in old_benches.items():
        now = benches.get(bid)
        if not check(now is not None, 'missing_historical_comparison', bid):
            continue
        check({k: v for k, v in now.items() if k != 'entries'} == {k: v for k, v in previous.items() if k != 'entries'}, 'historical_comparison_metadata_changed', bid)
        now_entries = {e['id']: e for e in now['entries']}
        for entry in previous['entries']:
            check(now_entries.get(entry['id']) == entry, 'historical_entry_changed', f"{bid}/{entry['id']}")
            counts['historical_entries_checked'] += 1

    tree = {}
    for item in git('ls-tree', '-rz', args.baseline_commit).split(b'\0'):
        if not item:
            continue
        info, path = item.split(b'\t', 1)
        _, kind, oid = info.decode().split()
        name = path.decode()
        if kind == 'blob' and (name in PROTECTED or name.startswith(('assets/', 'metadata/', 'previews/', 'references/'))):
            tree[name] = oid

    def preserve(item):
        name, expected = item
        measured = guarded(name, hashes, public_path(name))
        if measured:
            check(measured[2] == expected, 'historical_file_changed', name)
        return 1

    with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
        counts['historical_files_checked'] = sum(pool.map(preserve, tree.items()))

    package_expectations = {}
    image_paths = set()
    astra = {}
    for bench in current['benches']:
        check(len({e['id'] for e in bench['entries']}) == len(bench['entries']), 'duplicate_model_entry', bench['id'])
        image_paths.add(bench['reference'])
        for entry in bench['entries']:
            aid = entry['asset_id']
            package = (entry['file_size_bytes'], entry['sha256'])
            if entry['usdz'] in package_expectations:
                check(package_expectations[entry['usdz']] == package, 'conflicting_package_metadata', entry['usdz'])
            package_expectations[entry['usdz']] = package
            check(entry['download_url'] == RAW + entry['usdz'], 'download_url_mapping', aid)
            image_paths.update((entry['hero'], entry['inspection']))
            if entry['model'] == 'GPT-6 Astra':
                check(aid not in astra, 'duplicate_astra_asset_id', aid)
                astra[aid] = (bench, entry)
                check(entry['id'] == 'gpt-6-astra' and entry.get('run_id') == RUN, 'astra_attribution', aid)
                check('reviewed' not in entry and 'findings' not in entry, 'unexpected_astra_visual_verdict_fields', aid)
    for item in catalog['assets']:
        package_expectations[item['usdz']] = (item['file_size_bytes'], item['sha256'])
        for name in ('preview', 'reference'):
            if item.get(name):
                image_paths.add(item[name])
    check(len(astra) == 1280, 'astra_count', 'benchmarks.json')
    categories = dict(sorted(Counter(b['category_path'] for b, _ in astra.values()).items()))
    check(len(categories) == 64 and set(categories.values()) == {20}, 'astra_category_coverage', 'benchmarks.json')

    def package_check(item):
        name, expected = item
        measured = guarded(name, hashes, public_path(name))
        if measured:
            check(measured[:2] == expected, 'package_bytes_or_sha256_mismatch', name)
        return 1

    def image_check(name):
        info = guarded(name, image_info, public_path(name))
        if info:
            check(info['width'] > 0 and info['height'] > 0, 'invalid_image_dimensions', name)
        return info

    with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
        counts['unique_packages_checked'] = sum(pool.map(package_check, package_expectations.items()))
        infos = list(pool.map(image_check, sorted(image_paths)))
    counts['unique_images_checked'] = len(image_paths)
    image_dimensions = Counter(f"{info['width']}x{info['height']}" for info in infos if info)

    plan_sha = state_sha = None
    if source:
        qa = source / '3d-asset-design/qa' / RUN
        plan, state = read(qa / 'plan.json'), read(qa / 'run-state.json')
        plan_sha, state_sha = hashes(qa / 'plan.json')[1], hashes(qa / 'run-state.json')[1]
        rows = {row['asset_id']: row for row in plan['assets']}
        check(plan['state'] == 'complete' and len(rows) == 1280, 'production_plan_not_complete', RUN)
        check(set(rows) == set(astra), 'astra_plan_coverage', RUN)
        imported = read(root / 'reports/astra-import-summary.json')
        imported_bindings = {row['asset_id']: row for row in imported['published_input_bindings']}
        check(len(imported_bindings) == 1280, 'import_bindings_coverage', RUN)

        def verify_image(source_image, public_image, aid):
            native = image_info(source_image)
            published = image_info(public_image)
            width = min(900, native['width'])
            expected = {'width': width, 'height': round(native['height'] * width / native['width']), 'format': 'JPEG'}
            check(published == expected, 'transcoded_image_dimensions', aid + '/' + public_image.name)
            if args.verify_image_encoding:
                with Image.open(source_image) as im:
                    im = im.convert('RGB').resize((expected['width'], expected['height']), Image.Resampling.LANCZOS)
                    buffer = io.BytesIO()
                    im.save(buffer, format='JPEG', quality=85, subsampling=0, optimize=True, progressive=True)
                check(hashlib.sha256(buffer.getvalue()).hexdigest() == hashes(public_image)[1], 'web_image_source_encoding_mismatch', aid + '/' + public_image.name)
            return hashes(public_image)[1]

        def source_check(row):
            aid = row['asset_id']
            if aid not in astra:
                return None
            bench, entry = astra[aid]
            asset = source / row['asset_dir']
            reference = source / row['reference']
            check(bench['reference_asset_id'] == row['target_id'], 'wrong_reference_target', aid)
            check(bench['category_path'] == row['category_path'], 'wrong_category', aid)
            target = catalog_by_id[row['target_id']]
            if bench['id'] not in old_benches:
                check(bench['reference'] == target['reference'], 'wrong_public_reference', aid)
            check(hashes(reference)[1] == row['reference_sha256'], 'changed_authoritative_reference', aid)
            sealed = {}
            for stage in ('build', 'export', 'evidence'):
                current_stage = state['assets'][aid][stage]
                check(current_stage['status'] == 'pass', 'incomplete_source_stage', aid + '/' + stage)
                sealed.update(current_stage.get('outputs', {}))
            packages = list((asset / 'exports').glob('*.usdz'))
            if not check(len(packages) == 1, 'source_package_count', aid):
                return None
            source_files = {'usdz': packages[0], 'hero': asset / 'renders/hero.png', 'inspection': asset / 'renders/inspection.png', 'source_manifest': asset / 'source/astra_runtime/manifest.json'}
            measured = {}
            for name, path in source_files.items():
                size, sha, _ = hashes(path)
                bound = sealed.get(str(path.relative_to(source)))
                check(bound is not None and bound['size'] == size and bound['sha256'] == sha, 'sealed_source_digest_mismatch', aid + '/' + name)
                measured[name + '_sha256'] = sha
            check(measured['usdz_sha256'] == entry['sha256'], 'source_export_publication_mismatch', aid)
            imported_row = imported_bindings.get(aid, {})
            for field, expected in {'reference_asset_id': row['target_id'], 'comparison_id': bench['id'], 'production_bench_id': row['bench_id'], 'source_manifest_sha256': measured['source_manifest_sha256'], 'reference_sha256': row['reference_sha256'], 'hero_source_sha256': measured['hero_sha256'], 'inspection_source_sha256': measured['inspection_sha256'], 'usdz_sha256': measured['usdz_sha256']}.items():
                check(imported_row.get(field) == expected, 'import_source_binding_mismatch', aid + '/' + field)
            for name in ('hero', 'inspection'):
                measured[name + '_web_sha256'] = verify_image(source_files[name], public_path(entry[name]), aid)
            if bench['id'] not in old_benches:
                baselines = [e for e in bench['entries'] if e.get('reference_build')]
                if check(len(baselines) == 1 and baselines[0]['asset_id'] == row['target_id'], 'new_baseline_reference_mismatch', aid):
                    base = reference.parent.parent
                    for name in ('hero', 'inspection'):
                        verify_image(base / f'renders/{name}.png', public_path(baselines[0][name]), row['target_id'])
            return {'asset_id': aid, 'reference_asset_id': row['target_id'], 'comparison_id': bench['id'], 'public_usdz': entry['usdz'], 'reference_sha256': row['reference_sha256'], **measured}

        with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
            result = list(pool.map(lambda row: guarded(row['asset_id'], source_check, row), rows.values()))
        source_bindings = sorted((row for row in result if row), key=lambda row: row['asset_id'])
        counts['sealed_source_assets_checked'] = len(source_bindings)
        check(len(source_bindings) == 1280, 'source_binding_count', RUN)
    elif args.verify_image_encoding:
        check(False, 'image_encoding_requires_source', RUN)

    report = {
        'schema': 'benchmark-publication-integrity/v1',
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'result': 'pass' if not failures else 'fail',
        'scope': 'File, manifest, reference-identity and source-byte integrity. This is not a visual quality assessment or human/on-device certification.',
        'baseline_commit': args.baseline_commit,
        'verifier': 'tools/verify_benchmark_publication.py',
        'verifier_sha256': hashes(Path(__file__).resolve())[1],
        'publication_manifest_sha256': hashes(root / 'benchmarks.json')[1],
        'protected_file_sha256': {name: hashes(root / name)[1] for name in PROTECTED if (root / name).is_file()},
        'summary': {'comparison_count': len(benches), 'build_count': len(entries), 'model_build_counts': model_counts, 'astra_category_counts': categories, **dict(counts), 'failure_count': len(failures)},
        'public_image_dimension_counts': dict(sorted(image_dimensions.items())),
        'source_comparison': {'performed': source is not None, 'plan_sha256': plan_sha, 'run_state_sha256': state_sha, 'exact_web_image_encoding_checked': bool(source and args.verify_image_encoding), 'jpeg_encoder': 'Pillow ' + PIL.__version__, 'jpeg_settings': {'maximum_width': 900, 'quality': 85, 'subsampling': 0, 'optimize': True, 'progressive': True}},
        'failures': sorted(failures, key=lambda row: (row['subject'], row['code'])),
        'source_bindings': source_bindings,
    }
    serialized = json.dumps(report, indent=2, ensure_ascii=False) + '\n'
    if any(token in serialized for token in ('/home/', '/tmp/', 'file://', '.codex/')):
        raise ValueError('Public report unexpectedly contains a private filesystem path')
    output = args.output if args.output.is_absolute() else root / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + '.candidate')
    temporary.write_text(serialized, encoding='utf-8')
    temporary.replace(output)
    print(json.dumps({'result': report['result'], 'summary': report['summary'], 'source_compared': source is not None, 'exact_web_image_encoding_checked': bool(source and args.verify_image_encoding)}, indent=2))
    return 1 if failures else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as exc:
        # Keep private filesystem paths out of terminal/report diagnostics.
        print(json.dumps({'result': 'fail', 'error_type': type(exc).__name__, 'detail': 'Verifier could not finish; check required manifests and command arguments.'}), file=sys.stderr)
        sys.exit(2)
