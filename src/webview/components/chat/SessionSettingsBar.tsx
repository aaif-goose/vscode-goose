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
  setting: SessionSelectSetting;
  disabled: boolean;
  searchable?: boolean;
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
  setting,
  disabled,
  searchable = false,
  open,
  onToggle,
  onClose,
  onChange,
}: SettingMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () =>
      setting.options.find(option => option.value === setting.currentValue) ?? {
        value: setting.currentValue,
        name: setting.currentValue,
      },
    [setting.currentValue, setting.options]
  );

  const visibleOptions = useMemo(() => {
    const sortedOptions = [...setting.options].sort((a, b) => a.name.localeCompare(b.name));
    if (!searchable || query.trim() === '') {
      return sortedOptions;
    }

    const normalizedQuery = query.trim().toLowerCase();
    return sortedOptions.filter(option => {
      const haystacks = [option.name, option.value, option.description ?? ''];
      return haystacks.some(value => value.toLowerCase().includes(normalizedQuery));
    });
  }, [query, searchable, setting.options]);

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

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    if (searchable) {
      const timer = window.setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [open, searchable]);

  const handleSelect = (option: SessionSettingOption) => {
    onChange(option.value);
    onClose();
  };

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={`flex h-8 min-w-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
          open
            ? 'border-[var(--vscode-focusBorder)] bg-[var(--vscode-list-hoverBackground)] text-[var(--vscode-foreground)]'
            : 'border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]'
        } disabled:cursor-not-allowed disabled:opacity-60`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selectedOption.name}
      >
        <span className="truncate">{selectedOption.name}</span>
        <span className="text-[var(--vscode-descriptionForeground)]">
          <ChevronIcon open={open} />
        </span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 min-w-[240px] overflow-hidden rounded-xl border border-[var(--vscode-widget-border)] bg-[var(--vscode-quickInput-background)] shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          {searchable && (
            <div className="border-b border-[var(--vscode-panel-border)] px-2 pt-2 pb-1.5">
              <input
                ref={searchInputRef}
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Filter models"
                className="w-full rounded-md border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2.5 py-1.5 text-sm text-[var(--vscode-input-foreground)] focus:outline-none focus:border-[var(--vscode-focusBorder)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
              />
            </div>
          )}
          <div
            role="listbox"
            aria-label="Setting options"
            className="max-h-64 overflow-y-auto py-1"
          >
            {visibleOptions.map(option => {
              const isSelected = option.value === setting.currentValue;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`flex w-full items-start gap-2 px-2 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                      : 'text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]'
                  }`}
                >
                  <span className="mt-0.5 flex h-4 w-3.5 shrink-0 items-center justify-center text-[var(--vscode-descriptionForeground)]">
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
            {visibleOptions.length === 0 && (
              <div className="px-3 py-3 text-sm text-[var(--vscode-descriptionForeground)]">
                No matching options
              </div>
            )}
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
    <div className="flex flex-wrap items-center gap-1.5">
      {settings.mode && (
        <SettingMenu
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
          setting={settings.model}
          disabled={disabled}
          searchable
          open={openMenu === 'model'}
          onToggle={() => setOpenMenu(current => (current === 'model' ? null : 'model'))}
          onClose={() => setOpenMenu(current => (current === 'model' ? null : current))}
          onChange={onModelChange}
        />
      )}
    </div>
  );
}
