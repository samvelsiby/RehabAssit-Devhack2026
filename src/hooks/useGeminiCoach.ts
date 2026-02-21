/**
 * useGeminiCoach
 * Uses Gemini 2.0 Flash to generate:
 *  1. Real-time spoken coaching (1-2 sentences after each set / form issue)
 *  2. Detailed written session summary (displayed as a card after session ends)
 *
 * Requires VITE_GEMINI_API_KEY in .env.local
 */
import { useCallback, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

const SPOKEN_SYSTEM = `You are a friendly physiotherapy exercise coach.
Responses will be spoken aloud. Rules:
- Maximum 2 sentences.
- Spoken language only — no bullet points, markdown, or special characters.
- Be specific, positive, and clinically sound.
- Vary your wording, don't repeat the same phrase twice.`;

const SUMMARY_SYSTEM = `You are an expert physiotherapy exercise coach writing a post-session report.
Format your response in clean markdown with these sections:
## Overall Performance
## What You Did Well
## Form Issues Detected  
## How to Improve
## Next Session Focus
Be specific, clinical, and encouraging. Use bullet points within sections.
Reference the exact form issues provided. Keep the whole summary under 300 words.`;

export interface GeminiCoachOptions {
    onCoach: (text: string) => void;
    enabled?: boolean;
}

export interface SetLogEntry {
    setNumber: number;
    correctReps: number;
    incorrectReps: number;
    formScore: number;
    issues: string[];  // form feedback messages that appeared during this set
}

export function useGeminiCoach({ onCoach, enabled = true }: GeminiCoachOptions) {
    const isGenerating = useRef(false);
    const lastFormIssue = useRef('');

    const genAI = useRef<GoogleGenerativeAI | null>(
        API_KEY ? new GoogleGenerativeAI(API_KEY) : null
    );

    const isEnabled = enabled && !!API_KEY;

    // ── Core: short spoken coaching ────────────────────────────────────────────
    const generateSpoken = useCallback(async (prompt: string): Promise<void> => {
        if (!genAI.current || !isEnabled || isGenerating.current) return;
        isGenerating.current = true;
        try {
            const model = genAI.current.getGenerativeModel({
                model: 'gemini-2.0-flash',
                systemInstruction: SPOKEN_SYSTEM,
            });
            const result = await model.generateContent(prompt);
            const text = result.response.text().trim().replace(/[*_`#]/g, '');
            if (text) onCoach(text);
        } catch (err) {
            console.warn('[GeminiCoach] spoken error:', err);
        } finally {
            isGenerating.current = false;
        }
    }, [isEnabled, onCoach]);

    // ── Core: detailed written summary ─────────────────────────────────────────
    const generateSummaryText = useCallback(async (prompt: string): Promise<string> => {
        if (!genAI.current || !API_KEY) return '';
        try {
            const model = genAI.current.getGenerativeModel({
                model: 'gemini-2.0-flash',
                systemInstruction: SUMMARY_SYSTEM,
            });
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        } catch (err) {
            console.warn('[GeminiCoach] summary error:', err);
            return '';
        }
    }, []);

    // ── Public: spoken per-set coaching ────────────────────────────────────────
    const coachSetComplete = useCallback((params: {
        setNumber: number;
        totalSets: number;
        correctReps: number;
        incorrectReps: number;
        exerciseName: string;
        formIssues: string[];
    }) => {
        const { setNumber, totalSets, correctReps, incorrectReps, exerciseName, formIssues } = params;
        const totalReps = correctReps + incorrectReps;
        const accuracy = totalReps > 0 ? Math.round((correctReps / totalReps) * 100) : 100;
        const issueNote = formIssues.length > 0 ? `Main issue: "${formIssues[0]}".` : '';
        const restInfo = setNumber < totalSets ? `${totalSets - setNumber} sets remain.` : '';

        generateSpoken(
            `Exercise: ${exerciseName}. Set ${setNumber}/${totalSets} done. ` +
            `${correctReps} correct, ${incorrectReps} incorrect, ${accuracy}% accuracy. ` +
            `${issueNote} ${restInfo}`
        );
    }, [generateSpoken]);

    // ── Public: spoken one-liner for persistent form issue ─────────────────────
    const coachFormIssue = useCallback((issue: string, exerciseName: string) => {
        if (!issue || issue === lastFormIssue.current) return;
        if (['Good form!', 'Waiting for pose…', 'No pose detected'].includes(issue)) return;
        lastFormIssue.current = issue;
        generateSpoken(`Exercise: ${exerciseName}. Patient has form issue: "${issue}". Give 1 brief coaching cue.`);
    }, [generateSpoken]);

    // ── Public: spoken session complete ────────────────────────────────────────
    const coachSessionComplete = useCallback((params: {
        totalSets: number;
        totalCorrect: number;
        totalReps: number;
        exerciseName: string;
    }) => {
        const { totalSets, totalCorrect, totalReps, exerciseName } = params;
        const accuracy = totalReps > 0 ? Math.round((totalCorrect / totalReps) * 100) : 100;
        generateSpoken(
            `${exerciseName} session done! ${totalSets} sets, ${accuracy}% accuracy. ` +
            `Give a 1-2 sentence motivating closing.`
        );
    }, [generateSpoken]);

    // ── Public: detailed written per-set summary (returns markdown string) ──────
    const generateSetSummary = useCallback(async (params: {
        setNumber: number;
        totalSets: number;
        correctReps: number;
        incorrectReps: number;
        formScore: number;
        exerciseName: string;
        issues: string[];  // unique form issues that appeared during this set
    }): Promise<string> => {
        const { setNumber, totalSets, correctReps, incorrectReps, formScore, exerciseName, issues } = params;
        const totalReps = correctReps + incorrectReps;
        const issueList = issues.length > 0
            ? `Form issues detected: ${issues.join(', ')}.`
            : 'No significant form issues.';

        const prompt =
            `Exercise: ${exerciseName}. Set ${setNumber} of ${totalSets} just completed.\n` +
            `Results: ${correctReps} correct reps, ${incorrectReps} incorrect, ${totalReps} total, ${formScore}% form score.\n` +
            `${issueList}\n` +
            `Write a brief 2-3 sentence set summary: highlight what went well, flag any form issue with a specific correction, and motivate for the next set (or close positively if this was the last set). Keep it concise and direct.`;

        return generateSummaryText(prompt);
    }, [generateSummaryText]);

    // ── Public: detailed written session summary (returns markdown string) ─────────────
    const generateSessionSummary = useCallback(async (params: {
        exerciseName: string;
        sets: SetLogEntry[];
        allIssues: Array<{ issue: string; count: number }>; // issues + how many times flagged
    }): Promise<string> => {
        const { exerciseName, sets, allIssues } = params;

        const totalCorrect = sets.reduce((s, e) => s + e.correctReps, 0);
        const totalReps = sets.reduce((s, e) => s + e.correctReps + e.incorrectReps, 0);
        const overallAcc = totalReps > 0 ? Math.round((totalCorrect / totalReps) * 100) : 100;

        const setBreakdown = sets.map(s =>
            `Set ${s.setNumber}: ${s.correctReps} correct / ${s.correctReps + s.incorrectReps} total (${s.formScore}% form score)` +
            (s.issues.length > 0 ? `, issues: ${s.issues.join(', ')}` : '')
        ).join('\n');

        const issueList = allIssues.length > 0
            ? allIssues.map(i => `"${i.issue}" — occurred ${i.count} time(s)`).join('\n')
            : 'No significant form issues detected.';

        const prompt =
            `Exercise: ${exerciseName}\n` +
            `Total sets: ${sets.length}, Total reps: ${totalReps}, Overall accuracy: ${overallAcc}%\n\n` +
            `Per-set breakdown:\n${setBreakdown}\n\n` +
            `Form issues flagged during session:\n${issueList}\n\n` +
            `Write a detailed post-session summary report for this patient.`;

        return generateSummaryText(prompt);
    }, [generateSummaryText]);

    return {
        coachSetComplete,
        coachFormIssue,
        coachSessionComplete,
        generateSetSummary,
        generateSessionSummary,
        isEnabled,
        isApiKeyMissing: !API_KEY,
    };
}
