import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SessionSelectSetting,
  SessionSettingOption,
  SessionSettingsState,
} from '../../../shared/sessionTypes';

interface SessionSettingsBarProps {
  settings: SessionSettingsState;
  disabled: boolean;
  onModeChange: (modeId: string) => void;
  onModelChange: (modelId: string) => void;
}

interface SettingMenuProps {
  label: string;
  setting: SessionSelectSetting;
  disabled: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
}

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SettingMenu({
  label,
  setting,
  disabled,
  open,
  onToggle,
  onClose,
  onChange,
}: SettingMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () =>
      setting.options.find(option => option.value === setting.currentValue) ?? {
        value: setting.currentValue,
        name: setting.currentValue,
      },
    [setting.currentValue, setting.options]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  const handleSelect = (option: SessionSettingOption) => {
    onChange(option.value);
    onClose();
  };

  return (
    <div ref={containerRef} className="relative min-w-0">
      <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--vscode-descriptionForeground)]">
        {label}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={`flex h-8 min-w-0 items-center gap-2 rounded-full border px-3 text-sm transition-colors ${
          open
            ? 'border-[var(--vscode-focusBorder)] bg-[var(--vscode-list-hoverBackground)] text-[var(--vscode-foreground)]'
            : 'border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]'
        } disabled:cursor-not-allowed disabled:opacity-60`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedOption.name}</span>
        <span className="text-[var(--vscode-descriptionForeground)]">
          <ChevronIcon open={open} />
        </span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 min-w-[220px] overflow-hidden rounded-xl border border-[var(--vscode-widget-border)] bg-[var(--vscode-quickInput-background)] shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="border-b border-[var(--vscode-panel-border)] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--vscode-descriptionForeground)]">
            {label}
          </div>
          <div role="listbox" aria-label={label} className="max-h-64 overflow-y-auto py-1">
            {setting.options.map(option => {
              const isSelected = option.value === setting.currentValue;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`flex w-full items-start gap-3 px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                      : 'text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]'
                  }`}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[var(--vscode-descriptionForeground)]">
                    {isSelected ? <CheckIcon /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.name}</span>
                    {option.description && (
                      <span className="mt-0.5 block text-xs text-[var(--vscode-descriptionForeground)]">
                        {option.description}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function SessionSettingsBar({
  settings,
  disabled,
  onModeChange,
  onModelChange,
}: SessionSettingsBarProps) {
  const [openMenu, setOpenMenu] = useState<'mode' | 'model' | null>(null);

  if (!settings.mode && !settings.model) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-[var(--vscode-panel-border)] pt-3">
      {settings.mode && (
        <SettingMenu
          label="Mode"
          setting={settings.mode}
          disabled={disabled}
          open={openMenu === 'mode'}
          onToggle={() => setOpenMenu(current => (current === 'mode' ? null : 'mode'))}
          onClose={() => setOpenMenu(current => (current === 'mode' ? null : current))}
          onChange={onModeChange}
        />
      )}
      {settings.model && (
        <SettingMenu
          label="Model"
          setting={settings.model}
          disabled={disabled}
          open={openMenu === 'model'}
          onToggle={() => setOpenMenu(current => (current === 'model' ? null : 'model'))}
          onClose={() => setOpenMenu(current => (current === 'model' ? null : current))}
          onChange={onModelChange}
        />
      )}
    </div>
  );
}
