"use client";

import { useState, type FormEvent } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Label } from "@/src/components/ui/label";
import { ENGLISH, type LanguageOption } from "@/src/models/contentDiff";

interface ManageLanguagesDialogProps {
  languages: LanguageOption[];
  onAdd: (code: string, label: string) => string | null;
  onRemove: (code: string) => void;
}

const INPUT_CLASS =
  "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Lets the user manage the languages offered in the comparison. English is always listed and cannot be removed.
export function ManageLanguagesDialog({ languages, onAdd, onRemove }: ManageLanguagesDialogProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setCode("");
      setLabel("");
      setError(null);
    }
  };

  const handleAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = onAdd(code, label);
    setError(result);
    if (!result) {
      setCode("");
      setLabel("");
    }
  };

  return (
    <>
      <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setOpen(true)}>
        Manage languages
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Languages</DialogTitle>
            <DialogDescription>
              The label is shown in the comparison. The code is the locale sent to Sitecore, for example de-de.
            </DialogDescription>
          </DialogHeader>

          <ul className="flex flex-col gap-2">
            {languages.map((language) => (
              <li key={language.code} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{language.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{language.code}</span>
                </div>
                {language.code === ENGLISH ? (
                  <Badge colorScheme="neutral">Always available</Badge>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => onRemove(language.code)}>
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <p className="text-sm font-medium">Add a language</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-language-label">Label</Label>
                <input
                  id="new-language-label"
                  value={label}
                  onChange={(event) => {
                    setLabel(event.target.value);
                    setError(null);
                  }}
                  placeholder="for example German"
                  autoComplete="off"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-language-code">Code</Label>
                <input
                  id="new-language-code"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setError(null);
                  }}
                  placeholder="for example de-de"
                  autoComplete="off"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : (
                <span />
              )}
              <Button type="submit" variant="outline" disabled={code.trim() === "" || label.trim() === ""}>
                Add
              </Button>
            </div>
          </form>

          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
