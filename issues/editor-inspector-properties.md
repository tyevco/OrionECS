# Inspector & Property Editors

**Milestone:** v1.2.0 - Core Editor Features
**Priority:** Critical
**Labels:** editor, inspector, ui, properties
**Impact:** User Experience, Development Workflow

## Description

Implement the Inspector panel for viewing and editing entity properties, components, systems, and other game objects. This includes auto-generated property editors based on component types, custom editors for complex properties, and validation.

## Goals

- Display entity details and components
- Auto-generate property editors from TypeScript types
- Support custom property editors for complex types
- Validate property values in real-time
- Provide component add/remove UI
- Enable batch editing of multiple entities
- Support property search and filtering

## Dependencies

- Frontend Editor Application
- Scene Editor (for entity selection)
- TypeScript reflection or runtime type information

## Subtasks

### 1. Inspector Panel Layout
- [ ] Split into sections (Entity, Components, Tags)
- [ ] Collapsible sections
- [ ] Search/filter properties
- [ ] Compact vs expanded view modes
- [ ] Lock inspector to entity (prevent auto-switching)
- [ ] Pin inspector panel
- [ ] Multiple inspector tabs

### 2. Entity Information Section
- [ ] Entity name editor
- [ ] Entity ID display
- [ ] Active/inactive toggle
- [ ] Parent entity display and edit
- [ ] Children count and quick navigation
- [ ] Entity tags list
- [ ] Add/remove tags
- [ ] Entity layer/sorting layer

### 3. Component List
- [ ] List all components on entity
- [ ] Component enable/disable toggles
- [ ] Remove component button
- [ ] Reorder components (drag)
- [ ] Duplicate component (if supported)
- [ ] Component search
- [ ] Collapse/expand components
- [ ] Component context menu

### 4. Add Component UI
- [ ] "Add Component" button
- [ ] Searchable component picker
- [ ] Component categories
- [ ] Recently used components
- [ ] Favorite components
- [ ] Component preview/description
- [ ] Suggest components based on existing ones
- [ ] One-click add common components

### 5. Auto-Generated Property Editors
- [ ] **Number** - Number input with stepper
- [ ] **String** - Text input
- [ ] **Boolean** - Checkbox or toggle
- [ ] **Enum** - Dropdown select
- [ ] **Vector2/3** - Multiple number inputs (x, y, z)
- [ ] **Color** - Color picker
- [ ] **Range** - Slider with min/max
- [ ] **Object** - Nested property editor
- [ ] **Array** - List editor with add/remove

### 6. Advanced Property Editors
- [ ] **Entity Reference** - Entity picker dropdown
- [ ] **Asset Reference** - Asset picker with thumbnail
- [ ] **Curve Editor** - Visual curve editing
- [ ] **Gradient Editor** - Color gradient editor
- [ ] **Transform** - Position, rotation, scale combo
- [ ] **Bounds** - Min/max 2D/3D bounds
- [ ] **JSON** - Code editor for raw JSON
- [ ] **Multi-line Text** - Textarea

### 7. Property Metadata & Attributes
- [ ] @Range(min, max) - Slider with bounds
- [ ] @Min(value) / @Max(value) - Validation
- [ ] @Tooltip("text") - Help text on hover
- [ ] @Label("Custom Label") - Override property name
- [ ] @ReadOnly - Display only, can't edit
- [ ] @Hidden - Don't show in inspector
- [ ] @Category("Group") - Group properties
- [ ] @Color - Force color picker for number
- [ ] @Asset("image") - Asset type filter

### 8. Property Validation
- [ ] Real-time validation on input
- [ ] Show validation errors inline
- [ ] Prevent invalid values
- [ ] Suggest corrections
- [ ] Required field indicators
- [ ] Custom validation rules
- [ ] Dependency validation (requires other component)

### 9. Multi-Entity Editing
- [ ] Select multiple entities
- [ ] Show shared properties
- [ ] Edit shared properties simultaneously
- [ ] Show "mixed values" indicator
- [ ] Apply changes to all selected
- [ ] Batch add components
- [ ] Batch remove components

### 10. Property Copy/Paste
- [ ] Copy component values
- [ ] Paste component values
- [ ] Copy individual property
- [ ] Paste to multiple entities
- [ ] Copy as JSON
- [ ] Paste from JSON
- [ ] Property clipboard history

### 11. Property Reset & Defaults
- [ ] Reset property to default
- [ ] Reset component to defaults
- [ ] Reset all properties
- [ ] Show modified indicator (bold)
- [ ] Revert to prefab value (if prefab)
- [ ] Compare to default side-by-side

### 12. Property Drag & Drop
- [ ] Drag number property to other properties
- [ ] Drag entity from hierarchy to reference
- [ ] Drag asset to asset reference property
- [ ] Drag color to color property
- [ ] Visual feedback during drag
- [ ] Drop validation

### 13. Context Menus
- [ ] Property context menu (copy, paste, reset)
- [ ] Component context menu (remove, duplicate, help)
- [ ] Entity context menu (duplicate, delete, prefab)
- [ ] Quick actions in context menu
- [ ] Recent actions in context menu

### 14. Property History & Animation
- [ ] Track property changes
- [ ] Show property change timeline
- [ ] Animate property changes visually
- [ ] Undo/redo property changes
- [ ] Property change notifications
- [ ] Property watch/debug mode

### 15. Custom Component Editors
- [ ] Register custom editor for component type
- [ ] Custom editor React components
- [ ] Editor toolbar actions
- [ ] Visual editors (sprite editor, etc.)
- [ ] Editor preview
- [ ] Editor validation

### 16. Performance Optimization
- [ ] Virtualize long property lists
- [ ] Debounce property updates
- [ ] Batch property changes
- [ ] Lazy load property editors
- [ ] Memoize property renders
- [ ] Throttle validation
- [ ] Optimize re-renders

## Success Criteria

- [ ] All TypeScript primitive types supported
- [ ] Custom editors for complex types work well
- [ ] Property changes update viewport in real-time
- [ ] Multi-entity editing is intuitive
- [ ] Validation prevents invalid states
- [ ] Inspector is responsive and fast
- [ ] Custom component editors are extensible
- [ ] Property search finds relevant properties quickly

## Implementation Notes

**Inspector Component:**
```tsx
function InspectorPanel() {
  const selected = useEditorStore(s => s.selectedEntities);

  if (selected.length === 0) {
    return <EmptyState>No entity selected</EmptyState>;
  }

  if (selected.length === 1) {
    return <SingleEntityInspector entity={selected[0]} />;
  }

  return <MultiEntityInspector entities={selected} />;
}

function SingleEntityInspector({ entity }: { entity: Entity }) {
  return (
    <Panel title="Inspector">
      <EntitySection entity={entity} />
      <ComponentsSection entity={entity} />
      <AddComponentButton entity={entity} />
    </Panel>
  );
}
```

**Component Section:**
```tsx
function ComponentsSection({ entity }: { entity: Entity }) {
  const components = entity.getAllComponents();

  return (
    <div>
      {components.map(component => (
        <ComponentEditor
          key={component.constructor.name}
          entity={entity}
          component={component}
        />
      ))}
    </div>
  );
}

function ComponentEditor({ entity, component }: Props) {
  const [expanded, setExpanded] = useState(true);
  const componentType = component.constructor;

  return (
    <Collapsible
      header={
        <ComponentHeader
          name={componentType.name}
          onRemove={() => entity.removeComponent(componentType)}
          onToggle={() => setExpanded(!expanded)}
        />
      }
      expanded={expanded}
    >
      <PropertyGrid>
        {getProperties(component).map(prop => (
          <PropertyEditor
            key={prop.name}
            object={component}
            property={prop}
            onChange={(value) => {
              component[prop.name] = value;
              recordPropertyChange(entity, component, prop.name, value);
            }}
          />
        ))}
      </PropertyGrid>
    </Collapsible>
  );
}
```

**Auto-Generated Property Editor:**
```tsx
function PropertyEditor({ object, property, onChange }: Props) {
  const value = object[property.name];
  const metadata = getPropertyMetadata(property);

  // Determine editor type from metadata or value type
  const EditorComponent = getEditorForType(property.type, metadata);

  return (
    <div className="property-row">
      <label title={metadata.tooltip}>
        {metadata.label || property.name}
        {metadata.required && <span>*</span>}
      </label>

      <EditorComponent
        value={value}
        onChange={onChange}
        metadata={metadata}
        readonly={metadata.readonly}
      />

      {metadata.error && (
        <ErrorMessage>{metadata.error}</ErrorMessage>
      )}
    </div>
  );
}

// Type-specific editors
function NumberEditor({ value, onChange, metadata }: EditorProps<number>) {
  if (metadata.range) {
    return (
      <Slider
        value={value}
        onChange={onChange}
        min={metadata.range.min}
        max={metadata.range.max}
        step={metadata.step || 1}
      />
    );
  }

  return (
    <NumberInput
      value={value}
      onChange={onChange}
      min={metadata.min}
      max={metadata.max}
    />
  );
}

function Vector2Editor({ value, onChange }: EditorProps<Vector2>) {
  return (
    <div className="vector-editor">
      <NumberInput
        value={value.x}
        onChange={(x) => onChange({ ...value, x })}
        prefix="X"
      />
      <NumberInput
        value={value.y}
        onChange={(y) => onChange({ ...value, y })}
        prefix="Y"
      />
    </div>
  );
}

function ColorEditor({ value, onChange }: EditorProps<Color>) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="color-editor">
      <ColorSwatch
        color={value}
        onClick={() => setShowPicker(true)}
      />
      <HexInput value={value} onChange={onChange} />

      {showPicker && (
        <ColorPicker
          color={value}
          onChange={onChange}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
```

**Property Metadata System:**
```typescript
// Using decorators for metadata
class Transform {
  @Label("Position")
  @Tooltip("The position of the entity in world space")
  @Vector2()
  position: Vector2 = { x: 0, y: 0 };

  @Range(0, 360)
  @Tooltip("Rotation in degrees")
  rotation: number = 0;

  @Range(0.1, 10)
  @Label("Scale")
  scale: number = 1;

  @Color()
  tint: number = 0xFFFFFF;

  @ReadOnly()
  worldPosition: Vector2 = { x: 0, y: 0 };
}

// Or using static metadata
class Health {
  static propertyMetadata = {
    current: {
      label: "Current Health",
      tooltip: "The current health of the entity",
      min: 0,
      max: (obj: Health) => obj.max
    },
    max: {
      label: "Max Health",
      tooltip: "The maximum health",
      min: 1
    }
  };

  constructor(
    public current: number = 100,
    public max: number = 100
  ) {}
}
```

**Custom Component Editor:**
```tsx
// Register custom editor
registerComponentEditor(SpriteComponent, SpriteEditor);

function SpriteEditor({ entity, component }: ComponentEditorProps) {
  const sprite = component as SpriteComponent;

  return (
    <div>
      <PropertyEditor
        object={sprite}
        property="texture"
        onChange={(tex) => sprite.texture = tex}
      />

      {/* Custom preview */}
      <div className="sprite-preview">
        <img src={sprite.texture.url} alt="Sprite" />
      </div>

      {/* Custom controls */}
      <Button onClick={() => openSpriteEditor(sprite)}>
        Edit Sprite
      </Button>
    </div>
  );
}
```

**Multi-Entity Editing:**
```tsx
function MultiEntityInspector({ entities }: { entities: Entity[] }) {
  // Find shared components
  const sharedComponents = findSharedComponents(entities);

  return (
    <Panel title={`Inspector (${entities.length} selected)`}>
      <InfoBox>
        Editing {entities.length} entities. Only shared properties shown.
      </InfoBox>

      {sharedComponents.map(ComponentType => {
        const values = entities.map(e => e.getComponent(ComponentType));

        return (
          <MultiValueEditor
            key={ComponentType.name}
            componentType={ComponentType}
            values={values}
            onChange={(propName, value) => {
              // Apply to all entities
              entities.forEach(entity => {
                const comp = entity.getComponent(ComponentType);
                comp[propName] = value;
              });
              recordBatchPropertyChange(entities, ComponentType, propName, value);
            }}
          />
        );
      })}
    </Panel>
  );
}
```

## Related Issues

- Frontend Editor Application (new issue)
- Scene Editor Implementation (new issue)
- Code Editor Integration (new issue)
- #78 - Visual Scene Editor

## References

- [Unity Inspector](https://docs.unity3d.com/Manual/UsingTheInspector.html)
- [Godot Inspector](https://docs.godotengine.org/en/stable/tutorials/editor/inspector_dock.html)
- [React Hook Form](https://react-hook-form.com/) - Form handling
- [Zod](https://zod.dev/) - Runtime validation
- [ImGui](https://github.com/ocornut/imgui) - Immediate mode GUI inspiration
