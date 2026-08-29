import { useState } from 'react';

// Small reusable "copy to clipboard" button used for escrow IDs, invite
// links, and wallet addresses throughout the app.
export default function CopyButton({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, insecure context) — fail quietly.
    }
  };

  return (
    <button type="button" onClick={copy} className="btn-ghost whitespace-nowrap text-sm">
      {copied ? 'Copied' : label}
    </button>
  );
}
