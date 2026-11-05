"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/src/components/ui/accordion";
import { KNOWN_ISSUES } from "@/src/models/knownIssues";

// Question-and-answer list of issues found while building the app. Entries live in src/models/knownIssues.ts.
export function KnownIssuesMode() {
  if (KNOWN_ISSUES.length === 0) {
    return <p className="text-sm text-muted-foreground">No known issues recorded.</p>;
  }

  return (
    <Accordion type="multiple" className="w-full">
      {KNOWN_ISSUES.map((issue, index) => (
        <AccordionItem key={index} value={`issue-${index}`}>
          <AccordionTrigger className="text-left">{issue.question}</AccordionTrigger>
          <AccordionContent>
            <p className="text-sm text-muted-foreground">{issue.answer}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
