import React, { useMemo, useState } from 'react';

export interface AutocompleteOption {
  id: number;
  /** What the user sees and searches. */
  label: string;
}

interface AutocompleteSelectProps {
  id: string;
  options: AutocompleteOption[];
  /** The text in the box (held by the parent so it can be reset). */
  query: string;
  onQueryChange: (query: string) => void;
  /** The selected option's id, or '' when nothing is selected. */
  value: string;
  onSelect: (id: string) => void;
  /** Shows the red outline while no option is selected. */
  required?: boolean;
  maxLength?: number;
  emptyText?: string;
}

const inputBase =
  'bg-white border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all';
const inputOk = 'border-slate-300 focus:ring-emerald-500/40 focus:border-emerald-500';
const inputRequiredEmpty = 'border-red-500 focus:ring-red-500/40 focus:border-red-500';

/**
 * A type-ahead dropdown: the user sees the option labels, and the id of the chosen option is
 * what the parent receives. Typing again clears the earlier selection.
 */
export const AutocompleteSelect: React.FC<AutocompleteSelectProps> = ({
  id,
  options,
  query,
  onQueryChange,
  value,
  onSelect,
  required = false,
  maxLength = 50,
  emptyText = 'No matches',
}) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const matches = useMemo(() => {
    const q = query.toLowerCase().trim();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const choose = (option: AutocompleteOption) => {
    onSelect(String(option.id));
    onQueryChange(option.label);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(matches.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && open && matches[highlight]) {
      e.preventDefault();
      choose(matches[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        autoComplete="off"
        maxLength={maxLength}
        size={maxLength}
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          onSelect(''); // typing again clears the earlier selection
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        className={`${inputBase} w-full ${required && value === '' ? inputRequiredEmpty : inputOk}`}
      />
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-10 max-h-60 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg text-sm"
        >
          {matches.length > 0 ? (
            matches.map((option, index) => (
              <li
                key={option.id}
                role="option"
                aria-selected={String(option.id) === value}
                // mouse down (not click) so the input keeps focus until the choice is made
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={`px-3 py-2 cursor-pointer whitespace-pre ${
                  index === highlight ? 'bg-emerald-50 text-emerald-800' : 'text-slate-800'
                }`}
              >
                {option.label}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-slate-500">{emptyText}</li>
          )}
        </ul>
      )}
    </div>
  );
};
