# Better Notes - Claude Instructions

## NON-NEGOTIABLES

**Failure to follow these will result in immediate rollback:**

1. Write tests after completing each sprint or feature implementation
2. Run tests, lints, typechecks, builds and ensure there are no errors/warnings
3. Document learnings and progress in `docs/learnings.md` and `docs/progress.md`

## Philosophy

This codebase will outlive you. Every shortcut becomes someone else's burden. Every hack compounds into technical debt that slows the whole team down.

You are not just writing code. You are shaping the future of this project. The patterns you establish will be copied. The corners you cut will be cut again.

Fight entropy. Leave the codebase better than you found it.

---

# Project Architecture Rules

## File Organization

### Naming Convention (ENFORCED BY LINTER)

- **ALL files must be kebab-case** - No exceptions
- Examples: `animated-text.tsx`, `device-mockup.tsx`, `intro-scene.tsx`
- The linter will ERROR on any non-kebab-case files

### Component Size Limit

- **Each component file must be 400 lines or less**
- If a component exceeds 400 lines, split it into smaller components
- Extract reusable logic into custom hooks in `lib/hooks/`
- Extract complex render functions into sub-components

### Constants & Configuration

- **ALL constants go in `lib/constants/`** - not scattered throughout files
- Structure:
  ```
  lib/constants/
  ├── index.ts        # Re-exports all constants
  ├── animations.ts   # Animation timing, easing, spring configs
  ├── colors.ts       # Color palettes, theme colors
  ├── dimensions.ts   # Sizes, breakpoints, spacing
  └── defaults.ts     # Default prop values, fallbacks
  ```
- Import from `@/lib/constants` or `../constants`
- NO magic numbers in component files - extract to constants

### Next.js Server/Client Component Rules (CRITICAL)

**Pages are ALWAYS Server Components** - No exceptions

- NEVER add `"use client"` to page.tsx files
- Pages should handle data fetching, metadata, and layout
- Extract all client interactivity into separate components

**Component Composition Pattern:**

```
app/
├── (protected)/
│   └── dashboard/
│       └── page.tsx          # Server Component - NO "use client"
components/
├── dashboard/
│   ├── dashboard-header.tsx  # Client - has interactivity (sign out)
│   ├── dashboard-content.tsx # Client - has animations, hooks
│   └── project-list.tsx      # Client - uses Convex hooks
```

**Rules:**

1. **Page files (`page.tsx`)** = Server Components (can be async, fetch data)
2. **Interactive components** = Client Components in `/components/` folder
4. **Animations** (framer-motion) = Must be in Client Components
5. **Event handlers** (onClick, onChange) = Must be in Client Components

**Correct Pattern:**

```tsx
// app/(protected)/dashboard/page.tsx - SERVER (no "use client")
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default function DashboardPage() {
  return <DashboardContent />;
}

// components/dashboard/dashboard-content.tsx - CLIENT
"use client";
import { useQuery } from "convex/react";
// ... client-side logic
```

**Why This Matters:**

- SSR improves initial page load and SEO
- Server Components reduce client bundle size
- Clear separation of concerns
- Better caching and streaming

---

# Required Skills

## Planning & Brainstorming

Use `/superpowers:brainstorm` when:

- Starting a new feature or complex task
- Exploring multiple implementation approaches
- Breaking down large tasks into smaller pieces
- Solving non-obvious problems


## UI Development

When working on UI components, scenes, or visual elements:

```
/ui-skills                  # Core UI patterns
/rams                       # Dieter Rams design principles
/emil-design-engineering    # Design engineering patterns
/frontend-design            # Frontend design system patterns
```

## Three.js / 3D Graphics (from ~/.agents/skills/)

When working with 3D graphics, animations, or WebGL:

```
/threejs-fundamentals       # Core Three.js concepts
/threejs-animation          # Animation systems
/threejs-geometry           # Geometry and meshes
/threejs-materials          # Materials and textures
/threejs-lighting           # Lighting setup
/threejs-shaders            # Custom shaders
/threejs-postprocessing     # Post-processing effects
/threejs-interaction        # User interaction
/threejs-loaders            # Asset loading
/threejs-textures           # Texture handling
```

## Frontend Audit (MANDATORY)

After completing any UI/frontend work, ALWAYS run:

```
/vercel-react-best-practices
```

## Workflow for All Tasks

1. Before starting: Read `docs/learnings.md`, `docs/progress.md`
2. For complex tasks: Use `/superpowers:brainstorm` first
3. Invoke relevant skills based on task type:
   - UI work → `/ui-skills`, `/rams`, `/frontend-design`
   - 3D/WebGL → `/threejs-*` skills from ~/.agents/skills/
4. Implement following skill guidance
5. Run `/vercel-react-best-practices` to audit
6. Run `bun run check` (typecheck + lint)
7. Write tests
8. Update `docs/progress.md` and `docs/learnings.md`

---

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format & fix**: `bun run fix` or `bun x ultracite fix`
- **Check for issues**: `bun run lint` or `bun x ultracite check`
- **Full check**: `bun run check` (typecheck + lint)
- **Diagnose setup**: `bun x ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid raw HTML injection - use React's JSX instead
- Never use dynamic code execution functions
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `bun run fix` before committing to ensure compliance.
