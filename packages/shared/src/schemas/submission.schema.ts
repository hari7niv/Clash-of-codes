import { z } from 'zod';

/**
 * Supported languages -> Judge0 language ids.
 * The client only ever sends a language *key*; the server maps it to a Judge0 id,
 * so a malicious client can't ask the judge to run an arbitrary language runtime.
 */
export const LANGUAGES = {
  c: { id: 50, label: 'C (GCC 9.2.0)' },
  cpp: { id: 54, label: 'C++ (GCC 9.2.0)' },
  java: { id: 62, label: 'Java (OpenJDK 13.0.1)' },
  python: { id: 71, label: 'Python (3.8.1)' },
  javascript: { id: 63, label: 'JavaScript (Node.js 12.14.0)' },
  typescript: { id: 74, label: 'TypeScript (3.7.4)' },
  go: { id: 60, label: 'Go (1.13.5)' },
  rust: { id: 73, label: 'Rust (1.40.0)' },
} as const;

export type LanguageKey = keyof typeof LANGUAGES;

export const LANGUAGE_KEYS = Object.keys(LANGUAGES) as [LanguageKey, ...LanguageKey[]];

export const languageSchema = z.enum(LANGUAGE_KEYS);

/** Map a validated language key to its Judge0 id. */
export function languageId(key: LanguageKey): number {
  return LANGUAGES[key].id;
}

/** Shared source-code constraints. */
export const sourceCodeSchema = z.string().min(1).max(64 * 1024);

/** Practice submission via the REST api. */
export const submitCodeSchema = z.object({
  problemId: z.string().uuid(),
  language: languageSchema,
  sourceCode: sourceCodeSchema,
});

/** In-battle submission via the match-server socket. */
export const socketSubmitSchema = z.object({
  roomId: z.string().min(1),
  language: languageSchema,
  sourceCode: sourceCodeSchema,
});

export type SubmitCodeInput = z.infer<typeof submitCodeSchema>;
export type SocketSubmitInput = z.infer<typeof socketSubmitSchema>;
