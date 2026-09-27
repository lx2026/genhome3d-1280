#!/usr/bin/env python3
"""Add the sealed Astra1280 run to model comparisons without rebuilding the catalog.

Public output is an explicit metadata projection, never a copy of internal QA
ledgers. Existing model entry objects, findings, catalog packages and checksums
are preserved. USDZ downloads stay on the repository's raw host, outside Pages.
"""
from __future__ import annotations
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
from PIL import Image

REPOSITORY = 'lx2026/genhome3d-1280'
RUN = 'astra-2026-09-26'
MODEL = 'GPT-6 Astra'
ENTRY = 'gpt-6-astra'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def digest(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def value_digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + '.candidate')
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    temp.replace(path)


def verified(path, expected):
    if not path.is_file() or path.stat().st_size != expected['size'] or digest(path) != expected['sha256']:
        raise ValueError(f'Input no longer matches sealed evidence: {path.name}')


def web_image(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as im:
        im = im.convert('RGB')
        width = min(900, im.width)
        im = im.resize((width, round(im.height * width / im.width)), Image.Resampling.LANCZOS)
        temp = destination.with_name(destination.name + '.candidate')
        im.save(temp, format='JPEG', quality=85, subsampling=0, optimize=True, progressive=True)
        temp.replace(destination)


def copy_package(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp = destination.with_name(destination.name + '.candidate')
    shutil.copy2(source, temp)
    temp.replace(destination)


def public_run(production, efficiency, geometry):
    initial = efficiency['observed_processing_segments'][0]
    return {
        'run_id': RUN, 'model': MODEL, 'asset_count': 1280, 'category_count': 64,
        'hardware': 'NVIDIA DGX Spark / GB10',
        'render': {'engine': 'Blender Eevee', 'width': 1440, 'height': 1080, 'samples': 256, 'texture_resolution': [2048, 2048]},
        'timing': {
            'initial_production_minutes': efficiency['initial_1280_production_wall_seconds'] / 60,
            'initial_assets_per_minute': efficiency['initial_1280_assets_per_minute'],
            'first_complete_utc': efficiency['first_all_1280_complete_utc'],
            'latest_stage_finish_utc': efficiency['latest_stage_finish_utc'],
            'final_verification_utc': production['final_acceptance_utc'],
            'wall_hours_through_final_verification': production['end_to_end_seconds_through_final_verification'] / 3600,
            'unobserved_pause_hours': sum(g['seconds'] for g in efficiency['long_intersegment_gaps']) / 3600,
            'observed_processing_hours': efficiency['observed_processing_segment_seconds'] / 3600,
        },
        'gpu': {
            'initial_mean_percent': initial['gpu_utilization_percent']['mean'],
            'observed_mean_percent': efficiency['telemetry_observation_statistics']['gpu_utilization_percent']['mean'],
            'peak_percent': efficiency['telemetry_observation_statistics']['gpu_utilization_percent']['maximum'],
            'peak_host_used_ram_gib': efficiency['telemetry_observation_statistics']['host_used_ram_gib']['maximum'],
        },
        'historical_failures': efficiency['historical_failure_count'],
        'unmatched_stage_start_records': len(efficiency['stage_starts_without_matching_finish_record']),
        'technical_checks': {'usd_package_passes': production['packaged_usdz_validation_passes'], 'geometry_passes': geometry['summary']['pass_count'], 'maximum_triangles': geometry['summary']['max_evaluated_triangles'], 'triangle_budget': 75000, 'normalization_warnings': geometry['summary']['warning_count']},
        'method': 'GPT-6 Astra authored procedural geometry from the same authoritative references and declared dimensions, using shared Astra primitives and family builders. Multiple agents made iterative corrections before this final publication.',
        'limitations': [
            'These are final revised outputs, not an untouched first-attempt sample. Historical Opus and Fable records remain as previously published; methods, hardware, rendering and correction budgets differ, so this is not a controlled model ranking.',
            'Technical checks do not establish visual fidelity or a quality score. No human or on-device certification is claimed.',
            'Declared dimensions can alter the silhouette relative to the picture. Fine ornament, wood/stone microtexture, fabric folds and some constructions remain simplified.',
            'Native Cycles could not run because its CUDA kernel rejected GB10 sm_121; images use Eevee. Transparent materials can look milkier or clearer than the reference. Eevee display alpha and exported USD opacity are not equivalent.',
            'The long unobserved interval contains a usage-limit interruption. GPU statistics cover observed samples; absent telemetry is not imputed. Host RAM includes unrelated workloads. Concurrency observations do not prove a causal speedup.',
        ],
        'report': f'reports/{RUN}.json', 'report_markdown': f'reports/{RUN}.md',
        'timeline': 'reports/astra-efficiency-timeline.png', 'timeline_svg': 'reports/astra-efficiency-timeline.svg',
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source', type=Path, required=True)
    ap.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1])
    ap.add_argument('--jobs', type=int, default=8)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    qa = source / '3d-asset-design/qa' / RUN
    plan, state, production = (read(qa / name) for name in ('plan.json', 'run-state.json', 'production-report.json'))
    if plan['state'] != 'complete' or not production['benchmark_complete'] or state['summary']['completed'] != 1280 or state['summary']['active']:
        raise ValueError('Astra run must be complete and idle with final integrity evidence.')
    rows = plan['assets']
    if len(rows) != 1280 or len({r['asset_id'] for r in rows}) != 1280 or len({r['bench_id'] for r in rows}) != 1280:
        raise ValueError('Expected exactly1280 distinct Astra assets and reference targets.')
    protected = ['catalog.json', 'catalog.csv', 'checksums.sha256', 'reports/publication-audit.json', 'reports/bench-visual-qc.md']
    before = {name: digest(output / name) for name in protected}
    document = read(output / 'benchmarks.json')
    catalog = {r['id']: r for r in read(output / 'catalog.json')['assets']}
    benches = {b['id']: b for b in document['benches']}
    historical = {(b['id'], e['id']): deepcopy(e) for b in benches.values() for e in b['entries'] if e['model'] != MODEL}
    original_metadata = {b['id']: value_digest({k: v for k, v in b.items() if k != 'entries'}) for b in benches.values()}
    originals = set(benches)
    images = []
    packages = []
    input_bindings = []
    reference_slug_collisions = []
    for row in sorted(rows, key=lambda r: r['bench_id']):
        aid, bid, target = row['asset_id'], row['bench_id'], row['target_id']
        production_bid = bid
        if bid in benches and benches[bid]['reference_asset_id'] != target:
            bid = f'{bid}-{target.lower()}'
            reference_slug_collisions.append({'production_bench_id': production_bid, 'published_bench_id': bid, 'reference_asset_id': target})
        baseline = catalog[target]
        if baseline['category_path'] != row['category_path']:
            raise ValueError(f'Baseline category mismatch: {target}')
        asset = source / row['asset_dir']
        registry = read(source / '3d-asset-design/catalog/benchmarks' / f'{production_bid}.json')
        recorded = {e['asset_id']: e for e in registry['entries']}
        if registry['design_target']['reference_asset_id'] != target:
            raise ValueError(f'Reference mismatch: {bid}')
        if digest(source / row['reference']) != row['reference_sha256']:
            raise ValueError(f'Authoritative reference changed: {aid}')
        if bid not in benches:
            base_dir = (source / row['reference']).parent.parent
            base_meta = read(base_dir / 'metadata/asset.json')
            published = output / baseline['usdz']
            if digest(published) != baseline['sha256']:
                raise ValueError(f'Published catalog package changed: {target}')
            base_packages = list((base_dir / 'exports').glob('*.usdz'))
            if len(base_packages) != 1 or digest(base_packages[0]) != baseline['sha256']:
                raise ValueError(f'Baseline canonical images cannot be bound to published USDZ: {target}')
            hero, rear = (f'previews/benchmarks/{bid}/gpt-5-6-sol{suffix}.jpg' for suffix in ('', '-inspection'))
            images.extend([(base_dir / 'renders/hero.png', output / hero), (base_dir / 'renders/inspection.png', output / rear)])
            base_entry = {
                'id': 'gpt-5-6-sol', 'model': recorded[target]['model'], 'harness': recorded[target]['harness'],
                'built_on': recorded[target]['built_on'], 'method': recorded[target]['method'],
                'asset_id': target, 'title': baseline['title'], 'reference_build': True,
                'hero': hero, 'inspection': rear, 'dimensions_m': baseline['dimensions_m'],
                'geometry': baseline['geometry'],
                'validation': {k: baseline['validation'].get(k) for k in ('technical', 'package_audit', 'bounds', 'placement')},
                'recorded_attribution': {k: base_meta.get('provenance', {}).get(k) for k in ('author', 'model', 'harness')},
                **{k: baseline[k] for k in ('usdz', 'file_size_bytes', 'sha256', 'download_url')},
            }
            benches[bid] = {
                'id': bid, 'title': row['title'], 'summary': 'Same reference and declared dimensions, distinct model construction methods.',
                'brief': registry['design_target']['brief'], 'category_path': row['category_path'],
                'category_label': baseline['category_label'], 'dimensions_m': row['dimensions_m'],
                'reference': baseline['reference'], 'reference_asset_id': target,
                'observations': [], 'entries': [base_entry],
            }
        bench = benches[bid]
        if bench['reference_asset_id'] != target:
            raise ValueError(f'Existing comparison belongs to a different reference: {bid}')
        current = state['assets'][aid]
        if any(current[stage]['status'] != 'pass' for stage in ('build', 'export', 'evidence')):
            raise ValueError(f'Incomplete Astra stages: {aid}')
        sealed = {}
        for stage in ('build', 'export', 'evidence'):
            sealed.update(current[stage].get('outputs', {}))
        source_usdz = list((asset / 'exports').glob('*.usdz'))
        if len(source_usdz) != 1:
            raise ValueError(f'Expected one Astra package: {aid}')
        for path in [source_usdz[0], asset / 'renders/hero.png', asset / 'renders/inspection.png', asset / 'metadata/asset.json', asset / 'qa/usd-report.json', asset / 'source/astra_runtime/manifest.json']:
            verified(path, sealed[str(path.relative_to(source))])
        metadata, usd = read(asset / 'metadata/asset.json'), read(asset / 'qa/usd-report.json')
        if usd['result'] != 'pass' or not usd['package_audit']['pass']:
            raise ValueError(f'Astra package validation failed: {aid}')
        if metadata['identity']['stable_id'] != aid or metadata['provenance']['model'] != 'gpt-6-astra':
            raise ValueError(f'Astra attribution mismatch: {aid}')
        public_usdz = f'assets/benchmarks/{bid}/{ENTRY}.usdz'
        hero, rear = (f'previews/benchmarks/{bid}/{ENTRY}{suffix}.jpg' for suffix in ('', '-inspection'))
        packages.append((source_usdz[0], output / public_usdz))
        images.extend([(asset / 'renders/hero.png', output / hero), (asset / 'renders/inspection.png', output / rear)])
        dimensions, geo = metadata['dimensions'], metadata['geometry']
        entry = {
            'id': ENTRY, 'model': MODEL, 'harness': 'OpenAI Codex', 'built_on': recorded[aid]['built_on'],
            'method': recorded[aid]['method'] + ' Final output includes iterative corrections.',
            'run_id': RUN, 'asset_id': aid, 'title': metadata['identity']['title'], 'reference_build': False,
            'hero': hero, 'inspection': rear,
            'dimensions_m': {k: dimensions[k + '_m'] for k in ('width', 'depth', 'height')},
            'geometry': {'objects': geo['objects'], 'vertices': geo['evaluated_vertices'], 'triangles': geo['evaluated_triangles'], 'material_slots': metadata['materials']['slot_count']},
            'validation': {'technical': usd['result'], 'package_audit': 'pass', 'bounds': 'pass' if usd['bounds_match'] else 'fail', 'placement': 'pass' if usd['placement_plane_match'] else 'fail'},
            'recorded_attribution': {k: metadata['provenance'].get(k) for k in ('author', 'model', 'harness')},
            'render': {'engine': 'Blender Eevee', 'width': 1440, 'height': 1080, 'samples': current['build']['render_samples']},
            'usdz': public_usdz, 'file_size_bytes': source_usdz[0].stat().st_size,
            'sha256': sealed[str(source_usdz[0].relative_to(source))]['sha256'],
            'download_url': f'https://raw.githubusercontent.com/{REPOSITORY}/main/{public_usdz}',
        }
        bench['entries'] = [e for e in bench['entries'] if e['id'] != ENTRY] + [entry]
        input_bindings.append({'asset_id': aid, 'reference_asset_id': target, 'comparison_id': bid, 'production_bench_id': production_bid, 'source_manifest_sha256': sealed[str((asset / 'source/astra_runtime/manifest.json').relative_to(source))]['sha256'], 'reference_sha256': row['reference_sha256'], 'hero_source_sha256': sealed[str((asset / 'renders/hero.png').relative_to(source))]['sha256'], 'inspection_source_sha256': sealed[str((asset / 'renders/inspection.png').relative_to(source))]['sha256'], 'usdz_sha256': entry['sha256']})
    # Existing historical records are not re-exported from potentially changed sources.
    for (bid, eid), previous in historical.items():
        assert next(e for e in benches[bid]['entries'] if e['id'] == eid) == previous
    for bid, expected in original_metadata.items():
        assert value_digest({k: v for k, v in benches[bid].items() if k != 'entries'}) == expected
    document['benches'] = sorted(benches.values(), key=lambda b: b['id'])
    document['bench_count'] = len(benches)
    document['registered_bench_count'] = len(benches) + len(document.get('unpublished_benches', []))
    document['generated_on'] = datetime.now(timezone.utc).date().isoformat()
    document['note'] = 'Shared references and declared dimensions; model methods, hardware and correction budgets differ. Technical checks and published images are evidence, not quality scores.'
    model_counts = Counter(e['model'] for b in benches.values() for e in b['entries'])
    model_ids = {e['model']: e['id'] for b in benches.values() for e in b['entries']}
    document['models'] = [{'id': model_ids[m], 'name': m, 'build_count': model_counts[m], 'comparison_count': sum(any(e['model'] == m for e in b['entries']) for b in benches.values()), 'category_count': len({b['category_path'] for b in benches.values() if any(e['model'] == m for e in b['entries'])})} for m in sorted(model_counts)]
    context = public_run(production, read(qa / 'efficiency-report.json'), read(qa / 'geometry-audit-final.json'))
    document.setdefault('run_context', {})[ENTRY] = context
    summary = {'run_id': RUN, 'comparison_count': len(benches), 'entry_count': sum(model_counts.values()), 'model_build_counts': dict(model_counts), 'added_comparisons_this_invocation': len(set(benches) - originals), 'astra_package_count': len(packages), 'astra_package_bytes': sum(src.stat().st_size for src, _ in packages), 'preview_jobs': len(images), 'reference_slug_collisions': reference_slug_collisions, 'protected_files_sha256': before}
    if args.dry_run:
        print(json.dumps(summary, indent=2));return
    with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as executor:
        list(executor.map(lambda item: copy_package(*item), packages))
        for index, _ in enumerate(executor.map(lambda item: web_image(*item), images), 1):
            if index % 400 == 0:
                print(f'PREVIEWS {index}/{len(images)}', flush=True)
    for b in benches.values():
        for e in b['entries']:
            for key in ('hero', 'inspection', 'usdz'):
                if not (output / e[key]).is_file():
                    raise ValueError(f'Public link missing: {e[key]}')
        if not (output / b['reference']).is_file():
            raise ValueError(f'Public reference missing: {b["id"]}')
    for name, expected in before.items():
        if digest(output / name) != expected:
            raise ValueError(f'Protected publication file changed: {name}')
    write(output / 'benchmarks.json', document)
    write(output / context['report'], context)
    for ext in ('png', 'svg'):
        shutil.copy2(qa / f'efficiency-timeline.{ext}', output / f'reports/astra-efficiency-timeline.{ext}')
    report = ['# GPT-6 Astra run context', '', context['method'], '',
              f"Published builds: **1,280** across **64** categories. Native renders are1440×1080 Eevee at256 samples; this site uses smaller JPEG copies. Packages preserve the completed USDZ bytes.", '',
              f"The first complete set took **{context['timing']['initial_production_minutes']:.2f} minutes** ({context['timing']['initial_assets_per_minute']:.3f} assets/minute), with **{context['gpu']['initial_mean_percent']:.2f}%** mean observed GPU utilization. Wall time through final verification was **{context['timing']['wall_hours_through_final_verification']:.2f} hours**, including a **{context['timing']['unobserved_pause_hours']:.2f} hour** unobserved usage-limit interruption and later selective corrections.", '',
              f"Historical failed stage/source attempts: **{context['historical_failures']}**. Unmatched initial stage-start records: **{context['unmatched_stage_start_records']}**. Both remain in the accounting.", '',
              '## Comparability and limits', ''] + ['- ' + text for text in context['limitations']] + ['', '[Machine-readable run context](astra-2026-09-26.json)', '', '![Observed production and selective repairs](astra-efficiency-timeline.png)', '']
    (output / context['report_markdown']).write_text('\n'.join(report).replace('are1440', 'are 1440').replace('at256', 'at 256'), encoding='utf-8')
    summary.update(result='pass', new_preview_bytes=sum(dst.stat().st_size for _, dst in images), baseline_catalog_preserved=True, historical_entries_preserved=True, published_input_bindings=input_bindings)
    write(output / 'reports/astra-import-summary.json', summary)
    print(json.dumps({k: v for k, v in summary.items() if k != 'published_input_bindings'}, indent=2))

if __name__ == '__main__':
    main()
