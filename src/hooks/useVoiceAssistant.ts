/**
 * useVoiceAssistant — robust browser TTS
 * Key rules that make it work in Chrome:
 *  1. NEVER call cancel() before a normal speak() — it races and kills the utterance
 *  2. Set isSpeakingRef = true BEFORE the setTimeout, not in onstart, so no re-entry
 *  3. Voices are loaded via voiceschanged event (getVoices() is empty on first call)
 *  4. Watchdog resets stuck state if Chrome kills the utterance silently (15s bug)
 */
import { useCallback, useRef, useEffect } from 'react';

export function useVoiceAssistant(enabled: boolean = true) {
    const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
    const isSpeakingRef = useRef(false);
    const queueRef = useRef<Array<{ text: string; priority: boolean }>>([]);
    const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastFeedbackRef = useRef('');
    const lastCorrectRef = useRef(-1);

    // Load voices asynchronously (Chrome always returns [] on first call)
    useEffect(() => {
        if (!('speechSynthesis' in window)) return;
        const load = () => {
            const v = speechSynthesis.getVoices();
            if (v.length > 0) voicesRef.current = v;
        };
        load();
        speechSynthesis.addEventListener('voiceschanged', load);
        return () => speechSynthesis.removeEventListener('voiceschanged', load);
    }, []);

    // ── Core flush — only ONE item spoken at a time ──────────────────────────
    const flushQueue = useCallback(() => {
        if (!('speechSynthesis' in window)) {
            console.warn('[Voice] speechSynthesis not available');
            return;
        }
        if (isSpeakingRef.current || queueRef.current.length === 0) return;

        const next = queueRef.current.shift()!;

        // Mark as speaking IMMEDIATELY (before any async ops) to block re-entry
        isSpeakingRef.current = true;

        const utter = new SpeechSynthesisUtterance(next.text);
        utter.rate = 1.0;
        utter.pitch = 1.0;
        utter.volume = 1.0;

        // Select best available English voice
        const voices = voicesRef.current.length ? voicesRef.current : speechSynthesis.getVoices();
        const voice =
            voices.find(v => v.lang.startsWith('en') && /Samantha|Google UK|Neural|Natural|Karen|Moira/.test(v.name)) ??
            voices.find(v => v.lang === 'en-US') ??
            voices.find(v => v.lang.startsWith('en'));
        if (voice) utter.voice = voice;

        const done = () => {
            isSpeakingRef.current = false;
            if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
        };

        utter.onend = () => { done(); setTimeout(flushQueue, 60); };
        utter.onerror = (e) => {
            if (e.error !== 'interrupted' && e.error !== 'canceled') {
                console.warn('[Voice] error:', e.error);
            }
            done();
            setTimeout(flushQueue, 60);
        };

        // Watchdog: Chrome sometimes kills utterances without firing onend
        watchdogRef.current = setTimeout(() => {
            console.warn('[Voice] watchdog fired — resuming');
            done();
            flushQueue();
        }, 6_000);

        // KEY FIX: Chrome pauses speechSynthesis when getUserMedia stream is active.
        // Must call resume() before every speak() or the utterance queues but never starts.
        try {
            if (speechSynthesis.paused) {
                console.log('[Voice] was paused — resuming');
                speechSynthesis.resume();
            }
            // Wait a bit for resume to take effect
            setTimeout(() => {
                speechSynthesis.speak(utter);
                console.log('[Voice] spoke:', utter.text, '| paused:', speechSynthesis.paused, '| speaking:', speechSynthesis.speaking, '| pending:', speechSynthesis.pending);
            }, 50);
        } catch (e) {
            console.error('[Voice] speak error:', e);
            done();
        }
    }, []);

    // Keep-alive: Chrome pauses synthesis after tab media activity.
    // Calling resume() every 5s keeps it awake.
    useEffect(() => {
        if (!('speechSynthesis' in window)) return;
        const id = setInterval(() => {
            if (speechSynthesis.paused) {
                speechSynthesis.resume();
            }
        }, 5_000);
        return () => clearInterval(id);
    }, []);

    // ── Enqueue ───────────────────────────────────────────────────────────────
    const enqueue = useCallback((text: string, priority = false) => {
        if (!enabled || !('speechSynthesis' in window) || !text.trim()) {
            console.warn('[Voice] enqueue blocked:', { enabled, hasSpeech: 'speechSynthesis' in window, text });
            return;
        }
        console.log('[Voice] enqueuing:', text, 'priority:', priority);

        if (priority) {
            // Cancel, then wait for Chrome to finish processing before speaking
            speechSynthesis.cancel();
            if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
            isSpeakingRef.current = false;
            queueRef.current = [];
            setTimeout(() => {
                queueRef.current = [{ text, priority }];
                flushQueue();
            }, 80); // ← 80ms delay so Chrome finishes the cancel before we speak
        } else {
            // Normal: deduplicate and cap queue
            const last = queueRef.current[queueRef.current.length - 1];
            if (last?.text === text) return;
            queueRef.current.push({ text, priority });
            if (queueRef.current.length > 3) queueRef.current.shift(); // drop oldest
            flushQueue();
        }
    }, [enabled, flushQueue]);

    // ── Public API ────────────────────────────────────────────────────────────

    const announce = useCallback((text: string) => {
        console.log('[Voice] announce called:', text);
        // Test direct speech synthesis
        if ('speechSynthesis' in window && enabled) {
            try {
                const testUtter = new SpeechSynthesisUtterance(text);
                if (speechSynthesis.paused) speechSynthesis.resume();
                speechSynthesis.speak(testUtter);
                console.log('[Voice] direct speak attempted');
            } catch (e) {
                console.error('[Voice] direct speak failed:', e);
            }
        }
        enqueue(text, true);
    }, [enqueue, enabled]);

    const announceFeedback = useCallback((messages: string[]) => {
        if (!enabled || !messages.length) return;
        const msg = messages[0];
        if (msg === lastFeedbackRef.current) return;
        if (['Waiting for pose…', 'No pose detected'].includes(msg)) return;
        lastFeedbackRef.current = msg;
        enqueue(msg);
    }, [enabled, enqueue]);

    const announceRep = useCallback((correct: number, target: number) => {
        if (!enabled || correct === lastCorrectRef.current) return;
        lastCorrectRef.current = correct;
        if (correct <= 0) return;
        if (correct === target) {
            enqueue(`${correct} reps! Set done!`, true);
        } else if (correct % 5 === 0) {
            enqueue(`${correct} reps!`);
        } else if (correct === 1) {
            enqueue('Good rep!');
        }
    }, [enabled, enqueue]);

    const cancel = useCallback(() => {
        if ('speechSynthesis' in window) speechSynthesis.cancel();
        queueRef.current = [];
        isSpeakingRef.current = false;
        if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
    }, []);

    useEffect(() => { if (!enabled) cancel(); }, [enabled, cancel]);
    useEffect(() => () => cancel(), [cancel]);

    return { announce, announceFeedback, announceRep, cancel };
}
