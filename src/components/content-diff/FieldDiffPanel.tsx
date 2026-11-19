"use client";

import { differingFields, valuesOf } from "@/src/lib/contentDiff";
import type { FieldValues } from "@/src/models/contentDiff";
import type { DiffNodeState } from "@/src/utils/hooks/useContentDiff";

// Long values (rich text, layout JSON) are cut for display only. The full value is not shown here.
const MAX_VALUE_LENGTH = 500;

function FieldValueCell({ fields, name }: { fields: FieldValues; name: string }) {
  if (!fields.has(name)) return <span className="italic text-muted-foreground">(not present)</span>;
  const value = fields.get(name);
  if (value === null || value === undefined || value === "") {
    return <span className="italic text-muted-foreground">(empty)</span>;
  }
  const shown = value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value;
  return <span className="whitespace-pre-wrap break-words">{shown}</span>;
}

interface FieldDiffPanelProps {
  node: DiffNodeState | null;
  sourceName: string;
  targetName: string;
}

// Field values of the selected item that differ between the two environments.
export function FieldDiffPanel({ node, sourceName, targetName }: FieldDiffPanelProps) {
  if (!node) {
    return (
      <p className="text-sm text-muted-foreground">
        Click a red item&apos;s name in the tree to compare its field values.
      </p>
    );
  }

  const { source, target } = node;
  if (!source || !target) {
    const onlyIn = source ? sourceName : targetName;
    return (
      <p className="text-sm text-muted-foreground">
        {node.path} exists only in {onlyIn}, so there are no field values to compare.
      </p>
    );
  }

  const sourceValues = valuesOf(source);
  const targetValues = valuesOf(target);
  if (!sourceValues || !targetValues) {
    // The read failed on at least one side, e.g. the item's template is missing there.
    const sourceError = source.fields?.ok === false ? source.fields.error : null;
    const targetError = target.fields?.ok === false ? target.fields.error : null;
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p className="text-muted-foreground">
          The field values of <span className="font-medium text-foreground">{node.name}</span> could not be read, so
          they cannot be compared.
        </p>
        {sourceError && (
          <p>
            <span className="font-medium">{sourceName}:</span> {sourceError}
          </p>
        )}
        {targetError && (
          <p>
            <span className="font-medium">{targetName}:</span> {targetError}
          </p>
        )}
      </div>
    );
  }

  const fieldNames = differingFields(sourceValues, targetValues);
  if (fieldNames.length === 0) {
    return <p className="text-sm text-muted-foreground">No field differences for {node.name}.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {fieldNames.length} field(s) differ for <span className="font-medium text-foreground">{node.name}</span>.
      </p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Field</th>
              <th className="px-3 py-2 font-medium">{sourceName}</th>
              <th className="px-3 py-2 font-medium">{targetName}</th>
            </tr>
          </thead>
          <tbody>
            {fieldNames.map((name) => (
              <tr key={name} className="border-t align-top">
                <td className="px-3 py-2 font-medium">{name}</td>
                <td className="px-3 py-2">
                  <FieldValueCell fields={sourceValues} name={name} />
                </td>
                <td className="px-3 py-2">
                  <FieldValueCell fields={targetValues} name={name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
