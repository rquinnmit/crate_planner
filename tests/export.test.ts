/**
 * Export Module Tests
 *
 * Covers Rekordbox, Serato, BaseExporter helpers, and UniversalExporter flows.
 */

import * as fs from 'fs';
import * as path from 'path';

import { MusicAssetCatalog } from '../src/core/catalog';
import { Track, CamelotKey } from '../src/core/track';
import { CratePlanner, CratePlan, CratePrompt } from '../src/core/crate_planner';
import { RekordboxExporter, SeratoExporter, UniversalExporter, exportPlan } from '../src/export';

// ---------- Helpers ----------

const EXPORT_DIR = path.resolve('./tmp_test_exports');
const AUDIO_DIR = path.resolve('./tmp_test_audio');
const EXPORTS_DIR_FOR_MULTIPLE = path.resolve('./exports'); // BaseExporter.exportMultiple writes here

function ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function writeEmptyFile(filePath: string): void {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, '');
}

function createSampleTrack(id: string, overrides: Partial<Track> = {}, createFile: boolean = false): Track {
    const filePath = overrides.filePath || path.join(AUDIO_DIR, `${id}.mp3`);
    if (createFile) writeEmptyFile(filePath);
    return {
        id,
        artist: overrides.artist || 'Test Artist',
        title: overrides.title || id,
        genre: overrides.genre || 'Tech House',
        duration_sec: overrides.duration_sec ?? 240,
        bpm: overrides.bpm ?? 126,
        key: (overrides.key || '8A') as CamelotKey,
        energy: overrides.energy as any ?? 3,
        album: overrides.album,
        year: overrides.year,
        label: overrides.label,
        filePath,
    };
}

function createFinalizedPlan(catalog: MusicAssetCatalog, seedTrackIds: string[], promptOverrides: Partial<CratePrompt> = {}): CratePlan {
    const planner = new CratePlanner(catalog);
    const prompt: CratePrompt = {
        targetGenre: 'Tech House',
        tempoRange: { min: 120, max: 130 },
        ...promptOverrides
    };
    const plan = planner.createPlan(prompt, seedTrackIds);
    planner.finalize(plan);
    return plan;
}

// ---------- Test Suites ----------

async function testRekordboxExports(): Promise<void> {
    console.log('\n🧪 TEST: Rekordbox Exports');
    ensureDir(EXPORT_DIR);
    ensureDir(AUDIO_DIR);

    const catalog = new MusicAssetCatalog();
    const t1 = createSampleTrack('rb-001', { artist: 'Artist A', title: 'Alpha', bpm: 124 }, true);
    const t2 = createSampleTrack('rb-002', { artist: 'Artist B', title: 'Beta', bpm: 128 }, false);
    catalog.addTrack(t1);
    catalog.addTrack(t2);

    const plan = createFinalizedPlan(catalog, [t1.id]);

    const exporter = new RekordboxExporter(catalog);

    // M3U8
    const m3uOut = path.join(EXPORT_DIR, 'rekordbox_playlist');
    const m3uResultPromise = exporter.export(plan, {
        format: 'm3u8',
        outputPath: m3uOut,
        playlistName: 'Test Playlist',
        includeMetadata: true,
        relativePaths: false
    });

    // XML
    const xmlOut = path.join(EXPORT_DIR, 'rekordbox_playlist_xml');
    const xmlResultPromise = exporter.export(plan, {
        format: 'xml',
        outputPath: xmlOut,
        playlistName: 'Test XML Playlist',
        includeMetadata: true,
        relativePaths: true
    });

    const [m3uResult, xmlResult] = await Promise.all([m3uResultPromise, xmlResultPromise]);
    if (!m3uResult.success || !m3uResult.filePath) throw new Error('Rekordbox M3U8 export failed');
    if (!fs.existsSync(m3uResult.filePath)) throw new Error('M3U8 file not created');
    const m3uContent = fs.readFileSync(m3uResult.filePath, 'utf-8');
    if (!m3uContent.includes('#EXTM3U')) throw new Error('M3U8 missing header');
    if (!m3uContent.includes('#PLAYLIST:Test Playlist')) throw new Error('M3U8 missing playlist name');
    if (!m3uContent.includes('#EXTBPM:')) throw new Error('M3U8 missing metadata BPM');
    if (!m3uContent.includes('Artist A - Alpha')) throw new Error('M3U8 missing track line');

    if (!xmlResult.success || !xmlResult.filePath) throw new Error('Rekordbox XML export failed');
    if (!fs.existsSync(xmlResult.filePath)) throw new Error('XML file not created');
    const xmlContent = fs.readFileSync(xmlResult.filePath, 'utf-8');
    if (!xmlContent.includes('<DJ_PLAYLISTS')) throw new Error('XML missing root element');
    if (!xmlContent.includes('<COLLECTION')) throw new Error('XML missing collection');
    if (!xmlContent.includes('Location="')) throw new Error('XML missing Location attribute');
    console.log('  ✓ Rekordbox M3U8 and XML exports passed');
}

async function testSeratoExports(): Promise<void> {
    console.log('\n🧪 TEST: Serato Exports');
    ensureDir(EXPORT_DIR);
    ensureDir(AUDIO_DIR);

    const catalog = new MusicAssetCatalog();
    const t1 = createSampleTrack('sr-001', { artist: 'S Artist', title: 'Sigma', bpm: 122 }, true);
    const t2 = createSampleTrack('sr-002', { artist: 'S Artist', title: 'Tau', bpm: 124 }, false);
    catalog.addTrack(t1);
    catalog.addTrack(t2);

    const plan = createFinalizedPlan(catalog, [t1.id]);
    const exporter = new SeratoExporter(catalog);

    // M3U8
    const m3uOut = path.join(EXPORT_DIR, 'serato_crate');
    const m3uResult = await exporter.export(plan, {
        format: 'm3u8',
        outputPath: m3uOut,
        crateName: 'Test Crate',
        includeMetadata: true,
        relativePaths: false
    });
    if (!m3uResult.success || !m3uResult.filePath) throw new Error('Serato M3U8 export failed');
    const m3uContent = fs.readFileSync(m3uResult.filePath, 'utf-8');
    if (!m3uContent.includes('#PLAYLIST:Test Crate')) throw new Error('Serato M3U8 missing playlist name');

    // CSV
    const csvOut = path.join(EXPORT_DIR, 'serato_crate_csv');
    const csvResult = await exporter.export(plan, {
        format: 'csv',
        outputPath: csvOut,
        crateName: 'CSV Crate',
        includeHeaders: true,
        includeMetadata: true,
        relativePaths: true
    });
    if (!csvResult.success || !csvResult.filePath) throw new Error('Serato CSV export failed');
    const csvContent = fs.readFileSync(csvResult.filePath, 'utf-8');
    if (!csvContent.split('\n')[0].startsWith('name,artist,album,genre,bpm,key,duration,energy,location')) {
        throw new Error('CSV header missing or incorrect');
    }

    // TXT
    const txtOut = path.join(EXPORT_DIR, 'serato_crate_txt');
    const txtResult = await exporter.export(plan, {
        format: 'txt',
        outputPath: txtOut,
        crateName: 'TXT Crate',
        includeMetadata: true,
        relativePaths: false
    });
    if (!txtResult.success || !txtResult.filePath) throw new Error('Serato TXT export failed');
    const txt = fs.readFileSync(txtResult.filePath, 'utf-8');
    if (!txt.includes('TXT Crate')) throw new Error('TXT missing crate name');
    if (!/001\./.test(txt)) throw new Error('TXT missing numbered entries');
    if (!txt.includes('Total Tracks:')) throw new Error('TXT missing summary');

    console.log('  ✓ Serato M3U8, CSV, and TXT exports passed');
}

async function testRelativePathsInM3U8(): Promise<void> {
    console.log('\n🧪 TEST: Relative paths in M3U8');
    ensureDir(EXPORT_DIR);
    ensureDir(AUDIO_DIR);

    const catalog = new MusicAssetCatalog();
    const t1 = createSampleTrack('rel-001', { artist: 'Rel Artist', title: 'Rel Track', bpm: 125 }, true);
    const t2 = createSampleTrack('rel-002', { artist: 'Rel B', title: 'Rel B', bpm: 127 }, false);
    catalog.addTrack(t1);
    catalog.addTrack(t2);

    const plan = createFinalizedPlan(catalog, [t1.id]);
    const exporter = new RekordboxExporter(catalog);
    const out = path.join(EXPORT_DIR, 'relative_paths_playlist');
    const result = await exporter.export(plan, {
        format: 'm3u8',
        outputPath: out,
        playlistName: 'Rel Playlist',
        includeMetadata: false,
        relativePaths: true
    });
    if (!result.success || !result.filePath) throw new Error('M3U8 export failed');
    const content = fs.readFileSync(result.filePath, 'utf-8');
    const expectedRel = path.relative(path.dirname(result.filePath), t1.filePath!);
    if (!content.includes(expectedRel)) {
        throw new Error(`M3U8 should contain relative path ${expectedRel}`);
    }
    console.log('  ✓ Relative path generation passed');
}

function testValidateTracksForExport(): void {
    console.log('\n🧪 TEST: validateTracksForExport');
    const catalog = new MusicAssetCatalog();
    const t1 = createSampleTrack('val-001', {}, true);
    const tNoPath: Track = {
        id: 'val-nopath', artist: 'X', title: 'Y', bpm: 120, key: '8A' as CamelotKey, duration_sec: 200
    } as Track; // intentionally missing filePath
    catalog.addTrack(t1);
    catalog.addTrack(tNoPath);

    const dummyPlan: CratePlan = {
        prompt: {},
        trackList: [t1.id, tNoPath.id, 'does-not-exist'],
        annotations: '',
        totalDuration: 400,
        planDetails: { usedAI: false },
        isFinalized: true,
    } as any;

    const exporter = new RekordboxExporter(catalog);
    const validation = exporter.validateTracksForExport(dummyPlan);
    if (validation.valid) throw new Error('Validation should fail');
    const hasMissing = validation.errors.some(e => e.includes('has no file path'));
    const hasNotFound = validation.errors.some(e => e.includes('not found in catalog'));
    if (!hasMissing || !hasNotFound) throw new Error('Validation errors incomplete');
    console.log('  ✓ validateTracksForExport error reporting passed');
}

async function testExportMultiple(): Promise<void> {
    console.log('\n🧪 TEST: exportMultiple');
    ensureDir(EXPORTS_DIR_FOR_MULTIPLE);
    const catalog = new MusicAssetCatalog();
    const a = createSampleTrack('multi-001', {}, true);
    const b = createSampleTrack('multi-002', {}, false);
    catalog.addTrack(a);
    catalog.addTrack(b);
    const plan1 = createFinalizedPlan(catalog, [a.id]);
    const plan2 = createFinalizedPlan(catalog, [b.id]);

    const exporter = new RekordboxExporter(catalog);
    const results = await exporter.exportMultiple([plan1, plan2], 'rekordbox', { format: 'm3u8', includeMetadata: true } as any);
    if (results.length !== 2) throw new Error('exportMultiple should return two results');
    if (!results[0].success || !results[1].success) throw new Error('exportMultiple failed on one of the plans');
    console.log('  ✓ exportMultiple passed');
}

async function testUniversalExporter(): Promise<void> {
    console.log('\n🧪 TEST: UniversalExporter');
    ensureDir(EXPORT_DIR);
    const catalog = new MusicAssetCatalog();
    const t1 = createSampleTrack('uni-001', {}, true);
    const t2 = createSampleTrack('uni-002', {}, false);
    catalog.addTrack(t1);
    catalog.addTrack(t2);
    const plan = createFinalizedPlan(catalog, [t1.id]);

    const universal = new UniversalExporter(catalog);

    // Direct export
    const rbOut = path.join(EXPORT_DIR, 'universal_rb');
    const serOut = path.join(EXPORT_DIR, 'universal_serato');

    const [rbRes, serRes] = await Promise.all([
        universal.export(plan, { platform: 'rekordbox', outputPath: rbOut, format: 'm3u8', playlistName: 'U-RB' }),
        universal.export(plan, { platform: 'serato', outputPath: serOut, format: 'csv', playlistName: 'U-SER', includeMetadata: true })
    ]);
    if (!rbRes.success || !rbRes.filePath) throw new Error('Universal RB export failed');
    if (!serRes.success || !serRes.filePath) throw new Error('Universal Serato export failed');

    // exportPlan helper
    const planOut = path.join(EXPORT_DIR, 'export_plan_helper');
    const helperRes = await exportPlan(plan, catalog, 'serato', planOut, 'txt');
    if (!helperRes.success || !helperRes.filePath) throw new Error('exportPlan helper failed');
}

async function testExportToBothWithAndWithoutExt(): Promise<void> {
    console.log('\n🧪 TEST: UniversalExporter.exportToBoth (with and without ext)');
    ensureDir(EXPORT_DIR);
    const catalog = new MusicAssetCatalog();
    const t1 = createSampleTrack('both-001', {}, true);
    const t2 = createSampleTrack('both-002', {}, false);
    catalog.addTrack(t1);
    catalog.addTrack(t2);
    const plan = createFinalizedPlan(catalog, [t1.id]);

    const exporter = new UniversalExporter(catalog);

    // With extension
    const baseWithExt = path.join(EXPORT_DIR, 'both_case.m3u8');
    const results1 = await exporter.exportToBoth(plan, baseWithExt, { playlistName: 'BothCase' });
    if (!results1.rekordbox.success || !results1.serato.success) throw new Error('exportToBoth failed (with ext)');

    // Without extension (expected to produce _rekordbox.m3u8 and _serato.m3u8)
    const baseNoExt = path.join(EXPORT_DIR, 'both_case_no_ext');
    const results2 = await exporter.exportToBoth(plan, baseNoExt, { playlistName: 'BothNoExt' });
    if (!results2.rekordbox.success || !results2.serato.success) throw new Error('exportToBoth failed (no ext)');
    console.log('  ✓ exportToBoth passed (with and without ext)');
}

// ---------- Main Runner ----------

async function main(): Promise<void> {
    console.log('🎵 Export Module Test Suite');
    console.log('============================\n');

    try {
        await testRekordboxExports();
        await testSeratoExports();
        await testRelativePathsInM3U8();
        testValidateTracksForExport();
        await testExportMultiple();
        await testUniversalExporter();
        await testExportToBothWithAndWithoutExt();

        console.log('\n🎉 All Export Module tests passed successfully!');
    } catch (error) {
        console.error('\n❌ Export tests failed:', (error as Error).message);
        console.error((error as Error).stack);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}


