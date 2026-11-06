"use client";

import { Label } from "@/src/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";

export interface EnvironmentChoice {
  // Index into the environment list, as a string. Context IDs never reach the DOM.
  value: string;
  label: string;
  // Shown but not selectable, e.g. the environment a package was exported from.
  disabled?: boolean;
}

interface EnvironmentSelectProps {
  id: string;
  label: string;
  choices: EnvironmentChoice[];
  value: string | null;
  // Option that cannot be picked here, e.g. the source when choosing the destination.
  disabledValue?: string | null;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function EnvironmentSelect({
  id,
  label,
  choices,
  value,
  disabledValue,
  disabled,
  onChange,
}: EnvironmentSelectProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select key={value ?? "empty"} value={value ?? undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Choose an environment" />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem
              key={choice.value}
              value={choice.value}
              disabled={choice.disabled || choice.value === disabledValue}
            >
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
