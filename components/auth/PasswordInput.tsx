'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  /** Render a strength indicator under the input. Use on signup + reset, omit on login. */
  showStrength?: boolean;
};

/**
 * Password field with a show/hide toggle and an optional strength meter.
 *
 * Show/hide is a standard accessibility expectation — users can verify what
 * they typed without losing focus. The toggle button is `type="button"` so it
 * never accidentally submits the form, and is keyboard-reachable in normal
 * tab order.
 *
 * The strength meter is intentionally coarse (length + character-class
 * diversity). It is advisory only; real password policy is enforced server-
 * side via the zod schema.
 */
export default function PasswordInput({ label, showStrength = false, id, className, value, ...rest }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const text = typeof value === 'string' ? value : '';

  return (
    <div>
      <label htmlFor={inputId} className="text-text-secondary text-xs font-medium mb-1 block">
        {label}
      </label>
      <div className="relative">
        <input
          {...rest}
          id={inputId}
          type={visible ? 'text' : 'password'}
          value={value}
          className={`input-field pr-10 ${className ?? ''}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-text-muted hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-r-md"
          tabIndex={0}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {showStrength && text.length > 0 && <StrengthMeter password={text} />}
    </div>
  );
}

interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  color: string;
}

function scorePassword(pw: string): Strength {
  if (pw.length < 8) return { score: 0, label: 'Too short', color: 'bg-severity-critical' };
  let classes = 0;
  if (/[a-z]/.test(pw)) classes++;
  if (/[A-Z]/.test(pw)) classes++;
  if (/[0-9]/.test(pw)) classes++;
  if (/[^a-zA-Z0-9]/.test(pw)) classes++;
  const longEnough = pw.length >= 12;
  if (classes <= 1 && !longEnough) return { score: 1, label: 'Weak', color: 'bg-severity-high' };
  if (classes === 2 && !longEnough) return { score: 2, label: 'Fair', color: 'bg-severity-medium' };
  if (classes >= 3 && pw.length >= 10) return { score: 4, label: 'Strong', color: 'bg-accent-emerald' };
  return { score: 3, label: 'Good', color: 'bg-accent-blue' };
}

function StrengthMeter({ password }: { password: string }) {
  const s = scorePassword(password);
  const width = `${(s.score / 4) * 100}%`;
  return (
    <div className="mt-1.5 flex items-center gap-2" aria-live="polite">
      <div className="flex-1 h-1 bg-bg-tertiary rounded-full overflow-hidden">
        <div className={`h-full ${s.color} transition-all`} style={{ width }} />
      </div>
      <span className="text-[10px] text-text-muted w-16 text-right">{s.label}</span>
    </div>
  );
}
