/**
 * Local backup of an in-progress attempt.
 *
 * The runner tells a student their work is held on this device while they are
 * offline. Without this it was not: answers lived only in React state, so a tab
 * crash or an accidental close on a low-memory phone lost an exam the student
 * had been told was safe.
 *
 * This is a backup, never the source of truth. The server holds the real
 * answers, and a restored draft is re-sent for the server to accept or ignore.
 * Grading only ever uses what the server received.
 */
/**
 * An answer is free text or a single option id (string), or the set of chosen
 * option ids for a multi-answer question (string[]).
 */
export type AttemptAnswer = string | string[];

export type AttemptDraft = {
  attemptId: string;
  answers: Record<string, AttemptAnswer>;
  flagged: string[];
  savedAt: number;
};

const PREFIX = "lms.attempt-draft.";

// Long enough to survive a crash and a slow restart, short enough that a stale
// draft from a previous attempt can never resurface.
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

function key(attemptId: string): string {
  return PREFIX + attemptId;
}

export function saveAttemptDraft(draft: AttemptDraft): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key(draft.attemptId), JSON.stringify(draft));
  } catch {
    // Private browsing or a full quota. The server copy is still authoritative,
    // so failing to write a backup must never interrupt the exam.
  }
}

export function readAttemptDraft(attemptId: string): AttemptDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key(attemptId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as AttemptDraft;

    if (parsed.attemptId !== attemptId || typeof parsed.answers !== "object") return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      clearAttemptDraft(attemptId);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/** Called once the attempt is submitted, so nothing lingers on a shared device. */
export function clearAttemptDraft(attemptId: string): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key(attemptId));
  } catch {
    // Nothing useful to do; the entry expires on its own.
  }
}

/**
 * Removes drafts left behind by earlier attempts.
 *
 * Institution devices are often shared between students, and an exam draft is
 * not something to leave sitting in another person's browser.
 */
export function pruneOldDrafts(keepAttemptId: string): void {
  if (typeof window === "undefined") return;

  try {
    const stale: string[] = [];

    for (let i = 0; i < window.localStorage.length; i++) {
      const storageKey = window.localStorage.key(i);
      if (!storageKey?.startsWith(PREFIX)) continue;
      if (storageKey === key(keepAttemptId)) continue;
      stale.push(storageKey);
    }

    stale.forEach((storageKey) => window.localStorage.removeItem(storageKey));
  } catch {
    // Ignore: pruning is housekeeping, not correctness.
  }
}
