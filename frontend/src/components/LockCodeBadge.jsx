export default function LockCodeBadge({ code }) {
  return (
    <div className="flex gap-1.5" role="text" aria-label={`Lock code ${code.split('').join(' ')}`}>
      {code.split('').map((char, i) => (
        <span
          key={i}
          className="flex h-11 w-9 items-center justify-center rounded-md border border-navy-700/20 bg-navy-900 font-mono text-lg font-semibold text-emerald-400"
        >
          {char}
        </span>
      ))}
    </div>
  );
}
