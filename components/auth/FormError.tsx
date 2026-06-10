'use client';

interface Props {
  message: string;
  /** Server-issued request id surfaced via the response body or x-request-id header. */
  requestId?: string | null;
}

/**
 * Standardised error banner for auth forms. `role="alert"` + `aria-live="polite"`
 * means screen readers announce the message when it appears, not just on focus.
 * Shows the request id when present so users can quote it to support.
 */
export default function FormError({ message, requestId }: Props) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="mb-4 px-3 py-2.5 rounded-lg bg-severity-critical/10 text-severity-critical text-sm"
    >
      <div>{message}</div>
      {requestId && (
        <div className="mt-1 text-[10px] text-severity-critical/70 font-mono break-all">
          Reference: {requestId}
        </div>
      )}
    </div>
  );
}
