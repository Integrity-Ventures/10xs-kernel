# LLM Adapter Skeleton

## What is an Adapter?

An adapter is the interface file that maps governance doctrine to a specific AI coding tool. It binds the kernel's reusable governance methodology to a particular project and LLM.

**The relationship:**

```
Kernel Doctrine (reusable, LLM-agnostic)
    + Project Context (specific to your project)
    + LLM Adapter Format (specific to your tool)
    = Your Project's Governance Configuration
```

For example:
- **Claude Code** uses `CLAUDE.md` at the project root
- **Cursor** uses `.cursorrules`
- **Windsurf** uses `.windsurfrules`
- **Aider** uses `.aider.conf.yml` + conventions file
- **Any LLM** can consume a well-structured markdown document

The kernel doctrine is the reusable part. The adapter is the project-specific binding.

---

## Adapter Template Structure

Use this template to generate an adapter for any LLM tool. Replace `{placeholders}` with project-specific values.

```markdown
# {project_name} — AI Governance Configuration

## Project Context

- **Project:** {project_name}
- **Stack:** {tech_stack}
- **Hosting:** {hosting_platform}
- **Base Branch:** {base_branch}

## Role System

This project uses a governance role system. See:
- ROLE_PROJECT_MANAGER.md — Approval authority and role assignment
- ROLE_ARCHITECT.md — Architecture oversight and microtask creation
- ROLE_CODING_ASSISTANT.md — Implementation and quality enforcement

At session start, the project manager assigns one of these roles.

## Task Workflow

Follow the task workflow defined in TASK_WORKFLOW.md:
1. Architect creates microtask instructions
2. Coding assistant executes with evidence
3. PM validates, architect approves

## Code Standards

Follow CLEAN_ARCHITECTURE.md:
- File length: target {target_lines} lines, hard limit {max_lines} lines
- Complexity: cyclomatic complexity per function {max_complexity} or fewer
- Extract utilities at {extract_threshold} lines

## Quality Gates

Follow QA_VALIDATION.md:
- All automated tests must pass before completion
- Visual evidence required for UI components
- Diagnostic evidence required when bugs are reported
- Honest failure reporting — no false success claims

## Session Continuity

Follow SESSION_CONTINUITY.md:
- Retrieve context at session start
- Update handoff documents at session end
- Persist key decisions to memory

## Project-Specific Rules

{custom_rules}
```

---

## Default Values

| Placeholder | Default | Description |
|---|---|---|
| `{target_lines}` | 100 | Green zone file length target |
| `{max_lines}` | 200 | Hard limit for file length |
| `{max_complexity}` | 5 | Maximum cyclomatic complexity |
| `{extract_threshold}` | 80-100 | Lines at which to begin extraction |
| `{base_branch}` | main | Default branch for feature branches |

---

## Generating an Adapter

To create a governance adapter for your project:

1. **Choose your LLM tool** and its configuration format
2. **Copy the template above** into the appropriate file
3. **Fill in project-specific values** (stack, hosting, branch, custom rules)
4. **Reference doctrine documents** — keep the adapter concise, link to doctrine for details
5. **Add project-specific rules** that are unique to your codebase

### Adapter Sizing Guidelines

- **Adapter file:** 100-200 lines (project-specific bindings only)
- **Doctrine files:** Referenced, not duplicated
- **Custom rules:** Only rules that differ from kernel defaults

The adapter should be a thin binding layer. If it grows beyond 200 lines, extract project-specific governance into separate documents and reference them.

---

## Example: Minimal Adapter

For a simple project, the adapter might be:

```markdown
# My Project — AI Governance

Stack: Node.js + TypeScript + PostgreSQL
Base branch: main

## Standards
- Follow CLEAN_ARCHITECTURE.md (100-line target, 200-line limit)
- Follow TASK_WORKFLOW.md for microtask execution
- Follow QA_VALIDATION.md for quality gates

## Project Rules
- Use snake_case for database columns
- All API endpoints require authentication middleware
- Test coverage minimum: 80%
```

For a complex enterprise project, the adapter would be more detailed — but the doctrine documents remain the same.
