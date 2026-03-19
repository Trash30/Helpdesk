interface PasswordStrengthProps {
  password: string;
}

function getStrength(pwd: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (!pwd) return { level: 0, label: '', color: '' };
  const hasLen = pwd.length >= 8;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasDigit = /[0-9]/.test(pwd);

  if (hasLen && hasUpper && hasDigit) return { level: 3, label: 'Fort', color: '#639922' };
  if (hasLen && (hasUpper || hasDigit)) return { level: 2, label: 'Moyen', color: '#EF9F27' };
  return { level: 1, label: 'Faible', color: '#E24B4A' };
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const { level, label, color } = getStrength(password);
  if (!password) return null;

  const widths = ['0%', '33%', '66%', '100%'];

  return (
    <div className="mt-1.5 space-y-1">
      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: widths[level], backgroundColor: color }}
        />
      </div>
      {label && (
        <p className="text-xs" style={{ color }}>{label}</p>
      )}
    </div>
  );
}
