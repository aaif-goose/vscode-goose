@./AGENTS.md

<!-- rp1:start:v0.7.1 -->
## rp1 Knowledge Base

**Use Progressive Disclosure Pattern**

Location: `.rp1/context/`

Files:
- index.md (always load first)
- architecture.md
- modules.md
- patterns.md
- concept_map.md

Loading rules:
1. Always read index.md first.
2. Then load based on task type:
   - Code review: patterns.md
   - Bug investigation: architecture.md, modules.md
   - Feature work: modules.md, patterns.md
   - Strategic or system-wide analysis: all files

## rp1 Skill Awareness

You have access to rp1 skills. When you notice the user working on a task
that an rp1 skill addresses, briefly suggest it.

### Skill Categories
| Category | Skills | Suggest When |
|----------|--------|--------------|
| Development | /task, /bootstrap, /build, /build-fast, /feature-archive, /feature-edit, /feature-unarchive, /phase-plan, /speedrun | User starts a new feature, describes a change, or needs to scaffold a project |
| Investigation | /code-investigate, /validate-hypothesis | User is debugging, examining errors, or testing a design hypothesis |
| Quality | /code-comments, /code-audit, /code-check, /code-clean-comments | User finishes implementation and needs hygiene checks, audits, or comment cleanup |
| Review | /address-pr-feedback, /arcade-collab, /pr-review, /pr-visual | User prepares a PR, receives review feedback, or needs visual diff understanding |
| Documentation | /fix-mermaid, /generate-user-docs, /markdown-preview, /mermaid, /project-birds-eye-view, /write-content | User writes, updates, or previews docs, diagrams, or project overviews |
| Knowledge | /guide, /knowledge-build, /knowledge-load, /self-update | User needs codebase context, KB is stale, or wants KB templates |
| Strategy | /analyse-security, /deep-research, /strategize | User faces architectural decisions, security concerns, or needs deep research |
| Planning | /blueprint, /blueprint-archive, /blueprint-audit | User plans a project, audits a PRD, or manages blueprint lifecycle |
| Prompt | /create-prompt, /prompt-writer | User authors, rewrites, or evaluates agent prompts |

### Suggestion Rules
- Limit to 1 suggestion per turn. Format: skill name, one sentence why, offer to run.
- Do not re-suggest a skill the user declined this session.
- Do not suggest while an rp1 workflow is already running.
- Only suggest when there is a clear match to the user's current activity.
- For deeper questions about rp1, suggest the user invoke /guide.
<!-- rp1:end:v0.7.1 -->
