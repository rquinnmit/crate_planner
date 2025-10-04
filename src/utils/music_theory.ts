/**
 * Music Theory Utilities
 * 
 * Provides music theory calculations and utilities for DJ mixing,
 * including BPM compatibility, energy progression, and harmonic analysis.
 */

import { CamelotKey } from '../core/track';
import { getCompatibleKeys, getKeyDistance } from './camelot';

/**
 * Calculate BPM compatibility score (0-1, where 1 is perfect)
 * Based on how close two BPMs are and whether they're mixable
 * 
 * @param bpm1 - First track BPM
 * @param bpm2 - Second track BPM
 * @returns Compatibility score (0-1)
 * 
 * @example
 * getBPMCompatibility(128, 128) // Returns: 1.0 (perfect match)
 * getBPMCompatibility(128, 130) // Returns: ~0.95 (very compatible)
 * getBPMCompatibility(128, 140) // Returns: ~0.5 (less compatible)
 */
export function getBPMCompatibility(bpm1: number, bpm2: number): number {
    const diff = Math.abs(bpm1 - bpm2);
    
    // Perfect match
    if (diff === 0) return 1.0;
    
    // Within 2 BPM: excellent compatibility
    if (diff <= 2) return 0.95;
    
    // Within 5 BPM: good compatibility
    if (diff <= 5) return 0.85;
    
    // Within 10 BPM: acceptable
    if (diff <= 10) return 0.65;
    
    // Within 15 BPM: challenging but possible
    if (diff <= 15) return 0.4;
    
    // Beyond 15 BPM: difficult to mix
    return Math.max(0, 0.4 - (diff - 15) * 0.02);
}

/**
 * Check if two BPMs are mixable (within reasonable range)
 * 
 * @param bpm1 - First track BPM
 * @param bpm2 - Second track BPM
 * @param tolerance - Maximum BPM difference (default: 10)
 * @returns true if BPMs are mixable
 */
export function areBPMsMixable(bpm1: number, bpm2: number, tolerance: number = 10): boolean {
    return Math.abs(bpm1 - bpm2) <= tolerance;
}

/**
 * Calculate the optimal BPM transition path between two tracks
 * Suggests whether to speed up, slow down, or use half-time/double-time
 * 
 * @param fromBPM - Starting BPM
 * @param toBPM - Target BPM
 * @returns Transition suggestion
 */
export function getBPMTransition(fromBPM: number, toBPM: number): {
    method: 'direct' | 'half-time' | 'double-time' | 'gradual';
    adjustment: number;
    description: string;
} {
    const diff = toBPM - fromBPM;
    const absDiff = Math.abs(diff);
    
    // Check if half-time or double-time would work better
    const halfTimeDiff = Math.abs(toBPM - fromBPM / 2);
    const doubleTimeDiff = Math.abs(toBPM - fromBPM * 2);
    
    if (halfTimeDiff < 5 && halfTimeDiff < absDiff) {
        return {
            method: 'half-time',
            adjustment: fromBPM / 2 - toBPM,
            description: `Use half-time on first track (${Math.round(fromBPM / 2)} BPM)`
        };
    }
    
    if (doubleTimeDiff < 5 && doubleTimeDiff < absDiff) {
        return {
            method: 'double-time',
            adjustment: fromBPM * 2 - toBPM,
            description: `Use double-time on first track (${Math.round(fromBPM * 2)} BPM)`
        };
    }
    
    if (absDiff <= 10) {
        return {
            method: 'direct',
            adjustment: diff,
            description: diff > 0 ? `Speed up by ${absDiff} BPM` : `Slow down by ${absDiff} BPM`
        };
    }
    
    return {
        method: 'gradual',
        adjustment: diff,
        description: `Large BPM change (${diff > 0 ? '+' : ''}${diff} BPM) - consider gradual transition`
    };
}

/**
 * Calculate energy compatibility between two tracks
 * 
 * @param energy1 - First track energy (1-5)
 * @param energy2 - Second track energy (1-5)
 * @returns Compatibility score (0-1)
 */
export function getEnergyCompatibility(energy1: number, energy2: number): number {
    const diff = Math.abs(energy1 - energy2);
    
    // Same energy: perfect
    if (diff === 0) return 1.0;
    
    // One level difference: very good
    if (diff === 1) return 0.85;
    
    // Two levels: acceptable
    if (diff === 2) return 0.6;
    
    // Three or more: challenging
    return Math.max(0, 0.4 - (diff - 2) * 0.15);
}

/**
 * Validate energy progression for a set
 * Checks if energy flow makes sense (no sudden drops, good build-up)
 * 
 * @param energyLevels - Array of energy levels (1-5)
 * @param curve - Desired energy curve
 * @returns Validation result with suggestions
 */
export function validateEnergyProgression(
    energyLevels: number[],
    curve: 'linear' | 'wave' | 'peak' = 'linear'
): {
    isValid: boolean;
    score: number;
    issues: string[];
    suggestions: string[];
} {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0;
    
    if (energyLevels.length < 2) {
        return { isValid: true, score: 1.0, issues: [], suggestions: [] };
    }
    
    // Check for sudden drops (more than 2 levels)
    for (let i = 1; i < energyLevels.length; i++) {
        const drop = energyLevels[i - 1] - energyLevels[i];
        if (drop > 2) {
            issues.push(`Sudden energy drop at position ${i + 1} (${energyLevels[i - 1]} → ${energyLevels[i]})`);
            score -= 0.15;
        }
    }
    
    // Check curve adherence
    const avgEnergy = energyLevels.reduce((sum, e) => sum + e, 0) / energyLevels.length;
    const midPoint = Math.floor(energyLevels.length / 2);
    
    if (curve === 'peak') {
        // Should peak in the middle
        const peakIndex = energyLevels.indexOf(Math.max(...energyLevels));
        if (Math.abs(peakIndex - midPoint) > energyLevels.length * 0.3) {
            suggestions.push('Consider moving highest energy tracks closer to the middle');
            score -= 0.1;
        }
    } else if (curve === 'linear') {
        // Should gradually increase
        const firstHalf = energyLevels.slice(0, midPoint);
        const secondHalf = energyLevels.slice(midPoint);
        const firstAvg = firstHalf.reduce((sum, e) => sum + e, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, e) => sum + e, 0) / secondHalf.length;
        
        if (secondAvg < firstAvg) {
            suggestions.push('Energy should build throughout the set for linear progression');
            score -= 0.1;
        }
    }
    
    return {
        isValid: issues.length === 0,
        score: Math.max(0, score),
        issues,
        suggestions
    };
}

/**
 * Calculate overall transition quality between two tracks
 * Combines BPM, key, and energy compatibility
 * 
 * @param track1 - First track info
 * @param track2 - Second track info
 * @returns Overall compatibility score (0-1)
 */
export function getTransitionQuality(
    track1: { bpm: number; key: CamelotKey; energy?: number },
    track2: { bpm: number; key: CamelotKey; energy?: number }
): {
    overall: number;
    bpmScore: number;
    keyScore: number;
    energyScore: number;
    rating: 'excellent' | 'good' | 'fair' | 'challenging';
} {
    const bpmScore = getBPMCompatibility(track1.bpm, track2.bpm);
    
    // Key compatibility
    const compatibleKeys = getCompatibleKeys(track1.key);
    const keyScore = compatibleKeys.includes(track2.key) ? 1.0 : 0.3;
    
    // Energy compatibility
    const energyScore = (track1.energy && track2.energy)
        ? getEnergyCompatibility(track1.energy, track2.energy)
        : 0.7; // Neutral if energy not available
    
    // Weighted average (BPM and key are most important)
    const overall = (bpmScore * 0.4 + keyScore * 0.4 + energyScore * 0.2);
    
    let rating: 'excellent' | 'good' | 'fair' | 'challenging';
    if (overall >= 0.85) rating = 'excellent';
    else if (overall >= 0.7) rating = 'good';
    else if (overall >= 0.5) rating = 'fair';
    else rating = 'challenging';
    
    return {
        overall,
        bpmScore,
        keyScore,
        energyScore,
        rating
    };
}

/**
 * Suggest optimal track order based on music theory
 * Sorts tracks to minimize jarring transitions
 * 
 * @param tracks - Array of tracks with BPM, key, and energy
 * @returns Optimized track order (indices)
 */
export function suggestTrackOrder(
    tracks: Array<{ bpm: number; key: CamelotKey; energy?: number }>
): number[] {
    if (tracks.length <= 1) return tracks.map((_, i) => i);
    
    const order: number[] = [0]; // Start with first track
    const remaining = new Set(tracks.map((_, i) => i).slice(1));
    
    while (remaining.size > 0) {
        const currentIdx = order[order.length - 1];
        const currentTrack = tracks[currentIdx];
        
        // Find best next track
        let bestIdx = -1;
        let bestScore = -1;
        
        for (const idx of remaining) {
            const score = getTransitionQuality(currentTrack, tracks[idx]).overall;
            if (score > bestScore) {
                bestScore = score;
                bestIdx = idx;
            }
        }
        
        order.push(bestIdx);
        remaining.delete(bestIdx);
    }
    
    return order;
}

/**
 * Calculate the "mixability" of an entire set
 * Analyzes all transitions and provides overall score
 * 
 * @param tracks - Array of tracks in order
 * @returns Set analysis with scores and recommendations
 */
export function analyzeSetMixability(
    tracks: Array<{ bpm: number; key: CamelotKey; energy?: number }>
): {
    overallScore: number;
    transitionScores: number[];
    averageTransitionQuality: number;
    problematicTransitions: Array<{ index: number; score: number; reason: string }>;
    recommendations: string[];
} {
    if (tracks.length < 2) {
        return {
            overallScore: 1.0,
            transitionScores: [],
            averageTransitionQuality: 1.0,
            problematicTransitions: [],
            recommendations: []
        };
    }
    
    const transitionScores: number[] = [];
    const problematicTransitions: Array<{ index: number; score: number; reason: string }> = [];
    const recommendations: string[] = [];
    
    for (let i = 0; i < tracks.length - 1; i++) {
        const quality = getTransitionQuality(tracks[i], tracks[i + 1]);
        transitionScores.push(quality.overall);
        
        if (quality.overall < 0.5) {
            let reason = '';
            if (quality.bpmScore < 0.5) reason += 'Large BPM difference. ';
            if (quality.keyScore < 0.5) reason += 'Incompatible keys. ';
            if (quality.energyScore < 0.5) reason += 'Energy mismatch. ';
            
            problematicTransitions.push({
                index: i,
                score: quality.overall,
                reason: reason.trim()
            });
        }
    }
    
    const averageTransitionQuality = transitionScores.reduce((sum, s) => sum + s, 0) / transitionScores.length;
    const overallScore = averageTransitionQuality;
    
    // Generate recommendations
    if (problematicTransitions.length > 0) {
        recommendations.push(`${problematicTransitions.length} challenging transition(s) detected`);
    }
    
    if (overallScore < 0.7) {
        recommendations.push('Consider reordering tracks for smoother flow');
    }
    
    const bpmRange = Math.max(...tracks.map(t => t.bpm)) - Math.min(...tracks.map(t => t.bpm));
    if (bpmRange > 20) {
        recommendations.push('Wide BPM range - consider grouping similar tempos together');
    }
    
    return {
        overallScore,
        transitionScores,
        averageTransitionQuality,
        problematicTransitions,
        recommendations
    };
}

/**
 * Get the musical interval between two keys (in semitones)
 * Useful for understanding harmonic relationships
 * 
 * @param key1 - First Camelot key
 * @param key2 - Second Camelot key
 * @returns Interval in semitones (0-11)
 */
export function getKeyInterval(key1: CamelotKey, key2: CamelotKey): number {
    // Camelot wheel maps to circle of fifths
    // Each step is 7 semitones (perfect fifth)
    const num1 = parseInt(key1.slice(0, -1));
    const num2 = parseInt(key2.slice(0, -1));
    const letter1 = key1.slice(-1);
    const letter2 = key2.slice(-1);
    
    // Calculate circular distance
    let distance = getKeyDistance(key1, key2);
    
    // Adjust for major/minor difference (3 semitones)
    if (letter1 !== letter2) {
        distance = Infinity; // Different modes
    }
    
    // Convert Camelot distance to semitones (each step = 7 semitones)
    return (distance * 7) % 12;
}
