import * as React from 'react';
import { Checkbox } from './checkbox';
import { Input } from './input';

type Option = { label: string; value: number | string; subtitle?: string };

export function MultiSelect({
    options,
    selected,
    onSelectedChange,
    placeholder,
}: {
    options: Option[];
    selected: (number | string)[];
    onSelectedChange: (vals: number[]) => void;
    placeholder?: string;
}) {
    const [filter, setFilter] = React.useState('');
    const filtered = React.useMemo(
        () =>
            options.filter((o) =>
                (o.label + ' ' + (o.subtitle ?? '')).toLowerCase().includes(filter.toLowerCase())
            ),
        [options, filter]
    );

    function toggle(val: number) {
        const set = new Set(selected as number[]);
        set.has(val) ? set.delete(val) : set.add(val);
        onSelectedChange(Array.from(set) as number[]);
    }

    return (
        <div className="border rounded-md p-2 bg-input">
            <Input
                placeholder={placeholder ?? 'Search...'}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="mb-2 bg-background"
            />
            <div className="max-h-40 overflow-auto space-y-1">
                {filtered.map((o) => (
                    <label key={o.value} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer">
                        <Checkbox
                            checked={(selected as (number | string)[]).includes(o.value)}
                            onCheckedChange={() => toggle(Number(o.value))}
                        />
                        <div className="flex flex-col">
                            <span className="text-sm">{o.label}</span>
                            {o.subtitle && <span className="text-xs text-muted-foreground">{o.subtitle}</span>}
                        </div>
                    </label>
                ))}
                {filtered.length === 0 && (
                    <div className="text-xs text-muted-foreground px-1 py-2">No results</div>
                )}
            </div>
        </div>
    );
}
