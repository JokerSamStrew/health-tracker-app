import { useRef, useState } from 'react';
import { buildBackup, parseBackup, type ParsedBackup } from '../lib/backup.ts';
import type { DailyEntry, Profile } from '../types.ts';

export interface BackupPanelProps {
  entries: DailyEntry[];
  profile: Profile;
  /** The app's "today" date, used only in the exported filename. */
  referenceDate: string;
  /** Replaces all current data with the backup payload. */
  onImport: (entries: DailyEntry[], profile: Profile) => void;
}

type ImportStatus = { kind: 'idle' | 'success' | 'error'; message: string };

export function BackupPanel({ entries, profile, referenceDate, onImport }: BackupPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [status, setStatus] = useState<ImportStatus>({ kind: 'idle', message: '' });

  function handleExport(): void {
    const json = buildBackup(entries, profile, new Date().toISOString());
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `health-tracker-backup-${referenceDate}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus({ kind: 'success', message: `Exported ${entries.length} entries as JSON.` });
  }

  function handleImportFile(file: File): void {
    setStatus({ kind: 'idle', message: '' });
    setPending(null);
    // `FileReader` rather than `file.text()` so the flow stays testable in
    // jsdom, where `Blob.prototype.text` is unavailable.
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const parsed = parseBackup(text);
      if (!parsed) {
        setStatus({ kind: 'error', message: 'That file is not a valid Health Tracker backup.' });
        return;
      }
      setPending(parsed);
    };
    reader.onerror = () => {
      setStatus({ kind: 'error', message: 'The file could not be read.' });
    };
    reader.readAsText(file);
  }

  function confirmImport(): void {
    if (!pending) return;
    onImport(pending.entries, pending.profile);
    const skipped =
      pending.dropped > 0 ? ` ${pending.dropped} invalid entries were skipped.` : '';
    setStatus({
      kind: 'success',
      message: `Imported ${pending.entries.length} entries.${skipped}`,
    });
    setPending(null);
  }

  return (
    <section className="card backup" aria-label="Backup">
      <h3>Backup</h3>
      <p className="backup__intro">
        Export everything you have logged as a JSON file, and restore it later on this or another
        device. Importing replaces your current data.
      </p>

      {pending ? (
        <div className="backup__pending">
          <p>
            The file contains {pending.entries.length} entries. Importing replaces{' '}
            {entries.length === 0 ? 'your (empty) history' : `your ${entries.length} entries`} and
            the profile — this cannot be undone.
          </p>
          <div className="backup__actions">
            <button type="button" className="button button--danger" onClick={confirmImport}>
              Replace with this file
            </button>
            <button type="button" className="button button--ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="backup__actions">
          <button type="button" className="button button--ghost" onClick={handleExport}>
            Export all data (.json)
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => inputRef.current?.click()}
          >
            Import from file
          </button>
          <label className="sr-only" htmlFor="backup-file-input">
            Backup file
          </label>
          <input
            id="backup-file-input"
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleImportFile(file);
              event.target.value = '';
            }}
          />
        </div>
      )}

      {status.kind !== 'idle' ? (
        <p
          role={status.kind === 'error' ? 'alert' : 'status'}
          className={`backup__status backup__status--${status.kind}`}
        >
          {status.message}
        </p>
      ) : null}
    </section>
  );
}