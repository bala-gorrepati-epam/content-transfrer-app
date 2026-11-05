export interface KnownIssue {
  question: string;
  answer: string;
}

// Sample entries drawn from issues found while building the transfer. Replace or extend these.
export const KNOWN_ISSUES: KnownIssue[] = [
  {
    question: "Consume File state returns error 'The Azure Blob Storage connection string is invalid.'",
    answer:
      "Happens due to old Base Image. In Deploy App run Build and Deploy for the effected environment and test the same transfer again afterward.",
  },
];
