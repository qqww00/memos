export interface EngineeringTemplate {
  id: string;
  title: string;
  category: string;
  categoryColorHex: string;
  description: string;
  iconName: "FileCode2" | "Layers" | "Search" | "AlertTriangle" | "CheckSquare";
  templateContent: string;
}

export const ENGINEERING_TEMPLATES: EngineeringTemplate[] = [
  {
    id: "adr",
    title: "ADR (Architecture Decision Record)",
    category: "ADR",
    categoryColorHex: "#8b5cf6", // Purple
    description: "Document context, architectural choices, trade-offs, and consequences.",
    iconName: "FileCode2",
    templateContent: `# ADR: [Title of Architectural Decision]

## Status
Proposed

## Context
What is the technical problem, constraint, or requirement driving this decision?

## Decision
What is the architecture, framework, or pattern we are adopting?

## Consequences
- **Positive:** Key benefits and capabilities gained.
- **Negative:** Trade-offs, migration cost, or complexity.

## Alternatives Considered
- **Alternative 1:** Why it was not chosen.
- **Alternative 2:** Why it was not chosen.
`,
  },
  {
    id: "rfc",
    title: "RFC (Request for Comments)",
    category: "RFC",
    categoryColorHex: "#06b6d4", // Cyan
    description: "Propose a design, schema change, or technical initiative for team feedback.",
    iconName: "Layers",
    templateContent: `# RFC: [Proposal Title]

## Summary
A brief 2-3 sentence overview of what is proposed.

## Motivation & Goals
- **Goal 1:** Primary motivation.
- **Goal 2:** Expected velocity / reliability improvement.

## Proposed Design
Technical details, API contracts, or data models.

## Unresolved Questions & Action Items
- [ ] Finalize API payload definition
- [ ] Verify backward compatibility
- [ ] Team sign-off
`,
  },
  {
    id: "spike",
    title: "Technical Spike / Investigation",
    category: "Spike",
    categoryColorHex: "#f59e0b", // Amber
    description: "Timeboxed technical research, benchmarking, or proof-of-concept.",
    iconName: "Search",
    templateContent: `# Spike: [Topic of Investigation]

## Objective
What specific technical question or feasibility are we trying to prove?

## Hypothesis & Approach
- **Hypothesis:**
- **Experiment:**

## Findings & Benchmark Data
Summary of findings, metrics, and trade-offs.

## Action Items
- [ ] Document recommendations
- [ ] Create implementation tickets
`,
  },
  {
    id: "incident",
    title: "Incident Postmortem",
    category: "Incident",
    categoryColorHex: "#ef4444", // Red
    description: "Post-incident timeline, root cause analysis (5-Whys), and action items.",
    iconName: "AlertTriangle",
    templateContent: `# Incident Postmortem: [Brief Incident Title]

## Impact
- **Duration:** 30 minutes
- **Severity:** P1
- **Affected Services:**

## Timeline (UTC)
- **14:00** - Issue introduced
- **14:08** - Alert triggered
- **14:20** - Root cause identified
- **14:30** - Rollback / Fix deployed

## Root Cause
Technical explanation of why the failure occurred.

## Action Items
- [ ] Implement regression prevention
- [ ] Add monitoring / alert threshold
- [ ] Update runbook documentation
`,
  },
  {
    id: "review",
    title: "Code Review & QA Checklist",
    category: "Review",
    categoryColorHex: "#10b981", // Emerald
    description: "Thorough review checklist covering correctness, security, and performance.",
    iconName: "CheckSquare",
    templateContent: `# Code Review: [Feature / PR Description]

## Verification Checklist
- [ ] Architecture aligns with approved RFC/ADR
- [ ] Database queries are indexed (no N+1 queries)
- [ ] Security & auth checks validated
- [ ] Error handling & context wrapping in place
- [ ] Race detector and automated tests pass
- [ ] Documentation & types updated
`,
  },
];
