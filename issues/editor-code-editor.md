# Code Editor Integration - Monaco & TypeScript

**Milestone:** v1.2.0 - Core Editor Features
**Priority:** High
**Labels:** editor, code-editor, typescript, monaco
**Impact:** Development Workflow, User Experience

## Description

Integrate Monaco Editor (VS Code's editor) into the browser-based game editor for editing TypeScript code, component definitions, systems, and configuration files. Provide full TypeScript IntelliSense, error checking, auto-completion, and debugging features.

## Goals

- Provide professional code editing experience
- Full TypeScript support with type checking
- IntelliSense and auto-completion for OrionECS APIs
- Real-time error and warning display
- Code formatting and linting
- Multi-file editing with tabs
- Git integration and diff view

## Dependencies

- Monaco Editor library
- TypeScript compiler
- Frontend Editor Application

## Subtasks

### 1. Monaco Editor Setup
- [ ] Install Monaco Editor package
- [ ] Configure Monaco for React
- [ ] Set up editor theme (dark/light)
- [ ] Configure editor options (font, size, etc.)
- [ ] Load OrionECS type definitions
- [ ] Configure TypeScript compiler options
- [ ] Enable Web Workers for syntax checking

### 2. File System Integration
- [ ] File tree panel
- [ ] Create/rename/delete files and folders
- [ ] Drag and drop files
- [ ] File search
- [ ] Quick file open (Cmd+P)
- [ ] Recent files list
- [ ] File watcher for external changes

### 3. Editor Tabs & Multi-File Support
- [ ] Tab bar for open files
- [ ] Close/close all tabs
- [ ] Pin/unpin tabs
- [ ] Split editor (vertical/horizontal)
- [ ] Switch between tabs (Cmd+Tab)
- [ ] Unsaved changes indicator
- [ ] Tab context menu (close others, etc.)

### 4. TypeScript Language Features
- [ ] Syntax highlighting
- [ ] Code completion (IntelliSense)
- [ ] Parameter hints
- [ ] Hover type information
- [ ] Go to definition (F12)
- [ ] Find references (Shift+F12)
- [ ] Rename symbol (F2)
- [ ] Error and warning squiggles

### 5. OrionECS API IntelliSense
- [ ] Load OrionECS type definitions
- [ ] Component type completion
- [ ] System creation snippets
- [ ] Entity method completion
- [ ] Plugin API completion
- [ ] Custom JSDoc for OrionECS APIs
- [ ] Example code snippets

### 6. Code Actions & Quick Fixes
- [ ] Auto-import missing modules
- [ ] Organize imports
- [ ] Add missing types
- [ ] Convert to const/let/var
- [ ] Extract to function/variable
- [ ] Generate getters/setters
- [ ] Fix all auto-fixable issues

### 7. Code Formatting
- [ ] Format document (Shift+Alt+F)
- [ ] Format selection
- [ ] Format on save
- [ ] Configure Prettier integration
- [ ] ESLint integration
- [ ] Custom formatting rules
- [ ] Auto-fix on save

### 8. Code Navigation
- [ ] Go to symbol in file (Cmd+Shift+O)
- [ ] Go to symbol in workspace (Cmd+T)
- [ ] Breadcrumb navigation
- [ ] Peek definition
- [ ] Peek references
- [ ] Navigate backward/forward
- [ ] Bookmarks

### 9. Search & Replace
- [ ] Find in file (Cmd+F)
- [ ] Replace in file (Cmd+H)
- [ ] Find in files (Cmd+Shift+F)
- [ ] Replace in files (Cmd+Shift+H)
- [ ] Regex support
- [ ] Case sensitive toggle
- [ ] Whole word toggle

### 10. Git Integration
- [ ] Show file git status
- [ ] Inline diff view
- [ ] Stage/unstage changes
- [ ] Commit UI
- [ ] Branch switching
- [ ] Merge conflict resolution
- [ ] Git blame view

### 11. Problem Panel
- [ ] List all errors and warnings
- [ ] Group by file
- [ ] Filter by severity
- [ ] Click to navigate to problem
- [ ] Auto-refresh on file save
- [ ] Problem count in status bar

### 12. Code Snippets
- [ ] Built-in OrionECS snippets
- [ ] User-defined snippets
- [ ] Snippet placeholders
- [ ] Snippet variables (${1:name})
- [ ] Multi-cursor snippets
- [ ] Snippet suggestions in autocomplete

### 13. Editor Settings
- [ ] Font family and size
- [ ] Tab size and spaces
- [ ] Word wrap
- [ ] Minimap enable/disable
- [ ] Line numbers
- [ ] Bracket pair colorization
- [ ] Cursor style
- [ ] Ligatures

### 14. Keyboard Shortcuts
- [ ] Configurable keybindings
- [ ] VS Code compatible shortcuts
- [ ] Multi-cursor editing (Cmd+D)
- [ ] Column selection (Alt+Shift)
- [ ] Move line up/down (Alt+↑↓)
- [ ] Duplicate line (Shift+Alt+↑↓)
- [ ] Comment toggle (Cmd+/)

### 15. Performance Optimization
- [ ] Lazy load editor instance
- [ ] Virtualize large files
- [ ] Web Worker for type checking
- [ ] Debounce validation
- [ ] Incremental compilation
- [ ] Model caching
- [ ] Syntax highlighting optimization

### 16. Debugging Integration
- [ ] Breakpoint UI
- [ ] Debug console
- [ ] Variable inspection
- [ ] Call stack view
- [ ] Step over/into/out
- [ ] Watch expressions
- [ ] Conditional breakpoints

## Success Criteria

- [ ] Monaco loads in < 1 second
- [ ] Type checking completes in < 500ms
- [ ] IntelliSense suggestions appear instantly
- [ ] Syntax highlighting accurate for TypeScript
- [ ] Multi-file editing works smoothly
- [ ] All OrionECS APIs have IntelliSense
- [ ] Code formatting preserves user style
- [ ] Editor handles files > 10,000 lines

## Implementation Notes

**Monaco Setup:**
```tsx
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

// Configure Monaco
loader.config({ monaco });

function CodeEditor({ file }: { file: ProjectFile }) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>();

  useEffect(() => {
    const editor = monaco.editor.create(containerRef.current!, {
      value: file.content,
      language: getLanguageFromPath(file.path),
      theme: theme === 'dark' ? 'vs-dark' : 'vs-light',
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 14,
      tabSize: 2,
      insertSpaces: true,
      formatOnPaste: true,
      formatOnType: true
    });

    editorRef.current = editor;

    // Handle content changes
    editor.onDidChangeModelContent(() => {
      const content = editor.getValue();
      updateFile(file.path, content);
    });

    return () => editor.dispose();
  }, [file.path]);

  return <div ref={containerRef} className="editor-container" />;
}
```

**TypeScript Configuration:**
```typescript
// Configure TypeScript compiler
monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
  target: monaco.languages.typescript.ScriptTarget.ES2020,
  module: monaco.languages.typescript.ModuleKind.ESNext,
  lib: ['ES2020'],
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  allowNonTsExtensions: true,
  strict: true,
  esModuleInterop: true,
  jsx: monaco.languages.typescript.JsxEmit.React
});

// Add OrionECS type definitions
const orionEcsTypes = await fetch('/types/orion-ecs.d.ts').then(r => r.text());
monaco.languages.typescript.typescriptDefaults.addExtraLib(
  orionEcsTypes,
  'file:///node_modules/@types/orion-ecs/index.d.ts'
);

// Add user's project files as libraries for cross-file intellisense
projectFiles.forEach(file => {
  if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      file.content,
      `file:///${file.path}`
    );
  }
});
```

**Code Snippets:**
```typescript
// Register OrionECS snippets
monaco.languages.registerCompletionItemProvider('typescript', {
  provideCompletionItems: (model, position) => {
    return {
      suggestions: [
        {
          label: 'orion-component',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            'export class ${1:ComponentName} {',
            '  constructor(',
            '    public ${2:value}: ${3:number} = ${4:0}',
            '  ) {}',
            '}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create a new OrionECS component'
        },
        {
          label: 'orion-system',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            'engine.createSystem(\'${1:SystemName}\', {',
            '  all: [${2:ComponentType}]',
            '}, {',
            '  priority: ${3:100},',
            '  act: (entity, ${4:component}) => {',
            '    ${5:// System logic}',
            '  }',
            '});'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create a new OrionECS system'
        }
      ]
    };
  }
});
```

**Error Checking:**
```typescript
// Get TypeScript diagnostics
async function getTypeScriptErrors(file: ProjectFile): Promise<Diagnostic[]> {
  const uri = monaco.Uri.parse(`file:///${file.path}`);
  const model = monaco.editor.getModel(uri);

  if (!model) return [];

  // Get semantic errors
  const semanticErrors = await monaco.languages.typescript
    .getTypeScriptWorker()
    .then(worker => worker(uri))
    .then(client => client.getSemanticDiagnostics(uri.toString()));

  // Get syntactic errors
  const syntacticErrors = await monaco.languages.typescript
    .getTypeScriptWorker()
    .then(worker => worker(uri))
    .then(client => client.getSyntacticDiagnostics(uri.toString()));

  return [...semanticErrors, ...syntacticErrors].map(diag => ({
    severity: diag.category === 1 ? 'error' : 'warning',
    message: diag.messageText,
    startLine: diag.start,
    endLine: diag.start + diag.length
  }));
}
```

**Multi-File Tabs:**
```tsx
function EditorTabs() {
  const openFiles = useEditorStore(s => s.openFiles);
  const activeFile = useEditorStore(s => s.activeFile);

  return (
    <TabBar>
      {openFiles.map(file => (
        <Tab
          key={file.path}
          active={file.path === activeFile?.path}
          modified={file.modified}
          onClick={() => setActiveFile(file)}
          onClose={() => closeFile(file)}
        >
          <FileIcon type={getFileType(file.path)} />
          {getFileName(file.path)}
          {file.modified && <ModifiedIndicator>●</ModifiedIndicator>}
        </Tab>
      ))}
    </TabBar>
  );
}
```

**Quick File Open:**
```tsx
function QuickOpenModal() {
  const [search, setSearch] = useState('');
  const files = useEditorStore(s => s.projectFiles);

  const filtered = useMemo(() => {
    return fuzzySearch(files, search, f => f.path);
  }, [files, search]);

  return (
    <Modal title="Go to File" shortcut="Cmd+P">
      <Input
        placeholder="Search files..."
        value={search}
        onChange={setSearch}
        autoFocus
      />

      <FileList>
        {filtered.map(file => (
          <FileItem
            key={file.path}
            onClick={() => {
              openFile(file);
              closeModal();
            }}
          >
            {highlightMatches(file.path, search)}
          </FileItem>
        ))}
      </FileList>
    </Modal>
  );
}
```

## Related Issues

- Frontend Editor Application (new issue)
- In-Browser Development Environment (new issue)
- Visual Scripting Implementation (new issue)
- Backend Services (for file storage)

## References

- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [Monaco React](https://github.com/suren-atoyan/monaco-react)
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [VS Code](https://code.visualstudio.com/) - Feature inspiration
- [StackBlitz](https://stackblitz.com/) - Monaco in browser example
