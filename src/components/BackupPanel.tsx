import { useRef, useState } from 'react';
import { useI18n } from '../i18n/context.tsx';
import { buildBackup, parseBackup, type ParsedBackup } from '../lib/backup.ts';
import type { DailyEntry, Profile } from '../types.ts';

export interface BackupPanelProps {
  /** Anchor id used by the mobile section menu. */
  id?: string;
  entries: DailyEntry[];
  profile: Profile;
  /** The app's "today" date, used only in the exported filename. */
  referenceDate: string;
  /** Replaces all current data with the backup payload. */
  onImport: (entries: DailyEntry[], profile: Profile) => void;
}

type ImportStatus = { kind: 'idle' | 'success' | 'error'; message: string };

export function BackupPanel({
  id,
  entries,
  profile,
  referenceDate,
  onImport,
}: BackupPanelProps) {
  const { t } = useI18n();
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
    setStatus({ kind: 'success', message: t('backup.exported', { count: entries.length }) });
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
        setStatus({ kind: 'error', message: t('backup.invalid') });
        return;
      }
      setPending(parsed);
    };
    reader.onerror = () => {
      setStatus({ kind: 'error', message: t('backup.unreadable') });
    };
    reader.readAsText(file);
  }

  function confirmImport(): void {
    if (!pending) return;
    onImport(pending.entries, pending.profile);
    // The Russian sentence carries its own leading space; trim it so both
    // locales get exactly one before the skipped-count sentence.
    const skipped =
      pending.dropped > 0
        ? ` ${t('backup.skipped', { count: pending.dropped }).trimStart()}`
        : '';
    setStatus({
      kind: 'success',
      message: t('backup.imported', { count: pending.entries.length, skipped }),
    });
    setPending(null);
  }

  return (
    <section id={id} className="card backup" aria-label={t('backup.ariaLabel')}>
      <h3>{t('backup.title')}</h3>
      <p className="backup__intro">{t('backup.intro')}</p>

      {pending ? (
        <div className="backup__pending">
          <p>
            {t('backup.pending', {
              count: pending.entries.length,
              existing:
                entries.length === 0
                  ? t('backup.pendingEmpty')
                  : t('backup.pendingEntries', { count: entries.length }),
            })}
          </p>
          <div className="backup__actions">
            <button type="button" className="button button--danger" onClick={confirmImport}>
              {t('backup.replace')}
            </button>
            <button type="button" className="button button--ghost" onClick={() => setPending(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="backup__actions">
          <button type="button" className="button button--ghost" onClick={handleExport}>
            {t('backup.export')}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => inputRef.current?.click()}
          >
            {t('backup.import')}
          </button>
          <label className="sr-only" htmlFor="backup-file-input">
            {t('backup.fileLabel')}
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
