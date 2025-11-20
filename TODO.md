# TODO

- **Revamp system to simplify the engine**: Remove the `System` class, as it is mostly just a wrapper and unnecessary.
  -- moved entity and system into engine.ts to remove public access.
  -- inlining some methods, and passing reference of engine to entity/system.


- **Restrict entity creation**: No longer allow the creation of entities from outside the engine. This appears to be a flaw in the design.
  -- same as above, as this gives finer control to the engine itself. these are more limitations than before but it should help prevent accidently mis-use of the framework.

- **Non-overridable components**: Ensure components cannot be overridden once added to an entity.
  -- needs more thought...

- **Implement entity/component pooling**: Introduce pooling for entities and components to improve performance.
  -- added a pool and entity manager to start implementation.
  -- entity reset needs to be configured.
  -- possible changes to only store refs of components in the entity
  -- same as entity, but with systems for entities.