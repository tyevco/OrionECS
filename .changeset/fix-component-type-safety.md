---
"@orion-ecs/core": patch
---

Improve type safety for ComponentIdentifier by adding optional Args type parameter and fixing method signatures that incorrectly used ConstructorParameters<ComponentIdentifier<T>>. This enables TypeScript to correctly infer constructor argument types at call sites while maintaining backward compatibility.
