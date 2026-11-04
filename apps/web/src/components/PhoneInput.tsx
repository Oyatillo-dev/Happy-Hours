import type { InputHTMLAttributes } from 'react';

/** The 9 local digits of a Kyrgyz number, from whatever was typed or pasted (+996…, 0…). */
function localDigits(text: string) {
  let d = text.replace(/\D/g, '');
  if (d.startsWith('996') && d.length > 9) d = d.slice(3);
  else if (d.startsWith('0') && d.length > 9) d = d.slice(1);
  return d.slice(0, 9);
}

/** "700000002" → "700 000 002" */
const groups = (d: string) => d.replace(/(\d{3})(?=\d)/g, '$1 ');

/**
 * Phone field with a fixed +996 that cannot be erased; the rest is grouped by three digits.
 * `value` / `onChange` carry the full number ("+996700000002"), as normalizePhone expects.
 */
export function PhoneInput({
  value,
  onChange,
  large,
  ...rest
}: { value: string; onChange: (value: string) => void; large?: boolean } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
>) {
  return (
    <div className={`input phone-field ${large ? 'input-lg' : ''}`}>
      <span className="phone-prefix" aria-hidden>
        +996
      </span>
      <input
        {...rest}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="700 123 456"
        value={groups(localDigits(value.replace(/^\+996/, '')))}
        onChange={(e) => onChange(`+996${localDigits(e.target.value)}`)}
      />
    </div>
  );
}
