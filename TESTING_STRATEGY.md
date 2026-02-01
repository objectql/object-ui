# ObjectStack Testing Strategy

This document outlines the testing strategy designed to ensure the reliability and spec-compliance of the ObjectStack UI ecosystem. The goal is to enable **AI-Driven Development** where the test suite acts as a strict guardrail and feedback loop.

## 1. Philosophy: Validating the "Protocol"

ObjectUI is a **renderer**. Its primary job is to faithfully translate a JSON Protocol (`@objectstack/spec`) into a UI. Therefore, our tests must be structured around verifying this translation Contract.

### The "AI Feedback Loop" Principle
Tests should be descriptive enough that an AI Agent reading a failure message can understand:
1. Which part of the Spec failed.
2. What the JSON input was.
3. What the expected DOM output was.

## 2. Test Layers

### A. Spec Compliance Tests (The Contract)
*   **Location**: `apps/console/src/__tests__/SpecCompliance.test.tsx` (and similar in packages)
*   **Purpose**: To verify that **every** field type and layout definition in the Spec renders correctly in the reference app (Console).
*   **Methodology**:
    *   Iterate over the "Kitchen Sink" schema (which contains one of everything).
    *   Render the component.
    *   Assert semantic HTML attributes (e.g., `input[type="password"]` for `type: "password"`).
    *   **Crucial**: These tests ensure that adding a new feature to the spec doesn't break existing renderers.

### B. Component Unit Tests (The Atoms)
*   **Location**: `packages/components/src/__tests__`
*   **Purpose**: Test individual UI primitives (e.g., `Text`, `Badge`, `Card`) in isolation.
*   **Methodology**:
    *   Test `className` merging (Tailwind).
    *   Test property mapping (JSON props -> React props).
    *   Test event handling.

### C. Logic/kernel Tests (The Brain)
*   **Location**: `packages/core`, `packages/react`
*   **Purpose**: Test the non-visual logic.
*   **Methodology**:
    *   Expression evaluation (`visible: "${data.age > 18}"`).
    *   Data context scoping.
    *   Action dispatching.

## 3. The "Kitchen Sink" as the Gold Standard
The `examples/kitchen-sink` package is not just a demo; it is the **Conformance Suite**.
*   **Rule**: If a feature exists in ObjectStack, it MUST be represented in the Kitchen Sink.
*   **CI**: The Console tests import the Kitchen Sink schema and run assertions against it.

## 4. Implementation Guide (For Developers & AI)

When implementing a new feature:

1.  **Update the Spec**: Add the type to `@object-ui/types` or `@objectstack/spec`.
2.  **Update the Kitchen Sink**: Add an example usage in `examples/kitchen-sink`.
3.  **Run Compliance Tests**: `pnpm test` in `apps/console`. It should fail (missing renderer).
4.  **Implement Renderer**: Add the code in `@object-ui/components`.
5.  **Pass Tests**: Compliance tests pass when the new element is rendered correctly.

## 5. Directory Structure for Tests

```
apps/console/src/__tests__/
├── SpecCompliance.test.tsx    # <-- The "Grand Unified Test" using Kitchen Sink
├── AppStructure.test.tsx      # Tests routing and shell
└── ...

packages/components/src/__tests__/
├── atoms/                     # Button, Badge, etc.
├── fields/                    # Input, Select, etc.
└── ...
```
