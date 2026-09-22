# NORMEX Build Rules

NORMEX BUILD MODE = build first, harden later.

Product decision -> bounded implementation -> browser review -> adjust -> commit -> next workflow.

During active design: build -> view -> adjust -> use. Once a workflow is stable: test -> harden -> security review -> finalise.

Build first never permits bypassing tenant isolation, permission checks, or safe writes. Protect critical data integrity, but avoid exhaustive testing of temporary HTML/CSS/UI iterations.

Repository documentation is project memory. Codex conversation history is not the project source of truth.
