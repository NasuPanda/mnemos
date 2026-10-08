/**
 * The outcome of something a person asked for: accepted with a value, or refused with a reason
 * the UI can explain. Programming errors throw instead.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const refuse = <E>(error: E): Result<never, E> => ({ ok: false, error });
