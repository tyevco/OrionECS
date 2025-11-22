# In-Browser Development Environment

**Milestone:** v1.3.0 - Advanced Editor Features
**Priority:** High
**Labels:** editor, runtime, typescript, sandbox
**Impact:** Development Workflow, User Experience

## Description

Implement a complete in-browser development environment that allows running, debugging, and hot-reloading TypeScript code directly in the browser. This includes TypeScript compilation, module bundling, sandboxed execution, and development tools.

## Goals

- Compile and run TypeScript in the browser
- Hot reload code changes instantly
- Provide isolated execution environment
- Enable in-browser debugging
- Support npm package imports
- Maintain good performance

## Dependencies

- Monaco Editor (Code Editor Integration)
- esbuild-wasm or similar bundler
- Web Workers for isolation
- Service Worker for module loading

## Subtasks

### 1. TypeScript Compilation
- [ ] In-browser TypeScript compiler (using TS API)
- [ ] Compile on file save
- [ ] Incremental compilation
- [ ] Source map generation
- [ ] Emit to virtual file system
- [ ] Cache compiled output
- [ ] Show compilation errors
- [ ] Compilation progress indicator

### 2. Module Bundling
- [ ] Choose bundler (esbuild-wasm, Rollup, custom)
- [ ] Bundle entry point and dependencies
- [ ] Tree shaking
- [ ] Code splitting
- [ ] Asset handling (images, fonts)
- [ ] CSS bundling
- [ ] Source map support
- [ ] Bundle size optimization

### 3. Virtual File System
- [ ] In-memory file system
- [ ] Read/write operations
- [ ] File watching
- [ ] IndexedDB persistence
- [ ] Import path resolution
- [ ] Node module resolution
- [ ] File system API compliance

### 4. Package Management
- [ ] Install npm packages from CDN (esm.sh, unpkg)
- [ ] Parse package.json dependencies
- [ ] Resolve package versions
- [ ] Download and cache packages
- [ ] Type definitions for packages
- [ ] Package search UI
- [ ] Dependency tree visualization

### 5. Code Execution Sandbox
- [ ] iframe sandbox for isolation
- [ ] Web Worker execution
- [ ] Service Worker for module loading
- [ ] Restricted API access
- [ ] Sandbox escape prevention
- [ ] Memory limits
- [ ] Execution timeout
- [ ] Restart sandbox

### 6. Hot Module Replacement (HMR)
- [ ] Detect code changes
- [ ] Identify changed modules
- [ ] Preserve runtime state
- [ ] Apply module updates
- [ ] HMR API for user code
- [ ] Fallback to full reload
- [ ] HMR error handling

### 7. Development Server
- [ ] Virtual dev server in Service Worker
- [ ] Serve compiled files
- [ ] Live reload
- [ ] WebSocket for HMR messages
- [ ] CORS handling
- [ ] Asset serving
- [ ] API mocking

### 8. Console & REPL
- [ ] JavaScript console in editor
- [ ] Console.log capture from sandbox
- [ ] Error stack traces
- [ ] Console.warn, console.error styling
- [ ] Clear console
- [ ] Filter by log level
- [ ] REPL for live code evaluation
- [ ] Command history

### 9. Debugging Tools
- [ ] Set breakpoints in editor
- [ ] Pause on exceptions
- [ ] Step through code
- [ ] Inspect variables
- [ ] Watch expressions
- [ ] Call stack view
- [ ] Network request inspection
- [ ] Performance profiling

### 10. Error Handling & Display
- [ ] Runtime error capture
- [ ] Display error overlay
- [ ] Error stack traces with source maps
- [ ] Click to navigate to error location
- [ ] Syntax errors in console
- [ ] TypeScript errors in Problems panel
- [ ] Error suggestions and fixes

### 11. Preview & Live Reload
- [ ] Game preview iframe
- [ ] Auto-refresh on changes
- [ ] Preserve game state option
- [ ] Multiple device preview
- [ ] Preview in new window
- [ ] Responsive preview modes
- [ ] Preview screenshots

### 12. Build Output Inspection
- [ ] View compiled JavaScript
- [ ] View bundle stats
- [ ] Dependency graph visualization
- [ ] Bundle analyzer
- [ ] Performance metrics
- [ ] Build time tracking
- [ ] Asset size reporting

### 13. Performance Optimization
- [ ] Incremental compilation
- [ ] Compilation caching
- [ ] Lazy module loading
- [ ] Web Worker for compilation
- [ ] Debounce file changes
- [ ] Optimize bundle size
- [ ] Memory management

### 14. Import Maps & Module Resolution
- [ ] Support import maps
- [ ] Bare module resolution (import 'react')
- [ ] Relative imports
- [ ] Absolute imports
- [ ] Path aliases (@/components)
- [ ] TypeScript path mapping
- [ ] Dynamic imports

### 15. Environment Variables
- [ ] Define environment variables
- [ ] Access via process.env
- [ ] .env file support
- [ ] Secret management
- [ ] Environment-specific configs
- [ ] Build-time replacement

### 16. Testing Integration (Optional)
- [ ] Run tests in browser
- [ ] Test runner UI
- [ ] Test results display
- [ ] Coverage reports
- [ ] Watch mode for tests
- [ ] Snapshot testing

## Success Criteria

- [ ] TypeScript compiles in < 1 second
- [ ] Hot reload updates in < 500ms
- [ ] Sandbox is secure and isolated
- [ ] npm packages can be imported
- [ ] Debugging tools work correctly
- [ ] No memory leaks in long sessions
- [ ] Performance comparable to local development
- [ ] Clear error messages for all failures

## Implementation Notes

**Tech Stack Options:**

**Option 1: esbuild-wasm + iframe**
```typescript
import esbuild from 'esbuild-wasm';

// Initialize esbuild
await esbuild.initialize({
  wasmURL: '/esbuild.wasm'
});

// Compile and bundle
async function buildProject(files: ProjectFile[]) {
  const result = await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    plugins: [
      {
        name: 'virtual-fs',
        setup(build) {
          build.onResolve({ filter: /.*/ }, args => {
            return { path: args.path, namespace: 'virtual' };
          });

          build.onLoad({ filter: /.*/, namespace: 'virtual' }, args => {
            const file = files.find(f => f.path === args.path);
            return {
              contents: file?.content || '',
              loader: getLoader(args.path)
            };
          });
        }
      }
    ]
  });

  return result.outputFiles[0].text;
}
```

**Option 2: WebContainer (StackBlitz approach)**
```typescript
import { WebContainer } from '@webcontainer/api';

// Boot WebContainer
const webcontainer = await WebContainer.boot();

// Mount files
await webcontainer.mount({
  'package.json': {
    file: {
      contents: JSON.stringify({
        dependencies: { 'orion-ecs': '*' }
      })
    }
  },
  'src': {
    directory: {
      'index.ts': {
        file: { contents: projectFiles['src/index.ts'] }
      }
    }
  }
});

// Install dependencies
await webcontainer.spawn('npm', ['install']);

// Run dev server
const process = await webcontainer.spawn('npm', ['run', 'dev']);

process.output.pipeTo(new WritableStream({
  write(data) {
    console.log(data);
  }
}));
```

**Sandbox Execution:**
```typescript
// Create sandboxed iframe
function createSandbox(code: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.sandbox.add('allow-scripts');

  iframe.srcdoc = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; overflow: hidden; }
        canvas { display: block; }
      </style>
    </head>
    <body>
      <div id="game"></div>

      <script type="module">
        // Capture console output
        const originalLog = console.log;
        console.log = (...args) => {
          originalLog(...args);
          parent.postMessage({ type: 'console.log', args }, '*');
        };

        // Capture errors
        window.addEventListener('error', (e) => {
          parent.postMessage({
            type: 'runtime-error',
            message: e.message,
            stack: e.error?.stack
          }, '*');
        });

        // Run user code
        try {
          ${code}
        } catch (error) {
          parent.postMessage({
            type: 'runtime-error',
            message: error.message,
            stack: error.stack
          }, '*');
        }
      </script>
    </body>
    </html>
  `;

  document.body.appendChild(iframe);
  return iframe;
}

// Listen for messages from sandbox
window.addEventListener('message', (event) => {
  switch (event.data.type) {
    case 'console.log':
      addConsoleMessage('log', event.data.args);
      break;

    case 'runtime-error':
      showErrorOverlay(event.data.message, event.data.stack);
      break;
  }
});
```

**Hot Module Replacement:**
```typescript
interface HMRRuntime {
  // Accept updates for this module
  accept(callback?: () => void): void;

  // Accept updates for dependencies
  accept(deps: string[], callback: () => void): void;

  // Dispose callback before module is replaced
  dispose(callback: (data: any) => void): void;

  // Get data from old module
  data: any;
}

// In user code
if (import.meta.hot) {
  // Preserve state during hot reload
  import.meta.hot.dispose((data) => {
    data.entities = engine.getAllEntities();
    data.gameState = game.getState();
  });

  // Accept hot updates
  import.meta.hot.accept(() => {
    // Restore state after reload
    const { entities, gameState } = import.meta.hot.data;
    engine.restoreEntities(entities);
    game.restoreState(gameState);
  });
}

// HMR Server (in Service Worker or main thread)
class HMRServer {
  private clients = new Set<MessagePort>();

  async handleFileChange(path: string) {
    // Recompile changed file
    const newCode = await compileFile(path);

    // Find dependent modules
    const dependents = findDependents(path);

    // Notify clients
    this.clients.forEach(client => {
      client.postMessage({
        type: 'hmr:update',
        path,
        code: newCode,
        dependents
      });
    });
  }
}
```

**Package Management:**
```typescript
import { install } from '@esm/install';

async function installPackage(name: string, version: string) {
  // Fetch from CDN (esm.sh, unpkg, skypack)
  const url = `https://esm.sh/${name}@${version}`;

  const response = await fetch(url);
  const code = await response.text();

  // Cache in IndexedDB
  await cachePackage(name, version, code);

  // Fetch type definitions
  const types = await fetchTypes(name, version);
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    types,
    `file:///node_modules/@types/${name}/index.d.ts`
  );

  return code;
}

async function resolveImport(specifier: string): Promise<string> {
  // Check cache first
  const cached = await getFromCache(specifier);
  if (cached) return cached;

  // Install if not cached
  const [name, version = 'latest'] = specifier.split('@');
  return await installPackage(name, version);
}
```

**Console Implementation:**
```tsx
interface ConsoleMessage {
  type: 'log' | 'warn' | 'error' | 'info';
  args: any[];
  timestamp: number;
  stack?: string;
}

function ConsolePanel() {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [filter, setFilter] = useState<string[]>(['log', 'warn', 'error']);

  const filtered = messages.filter(m => filter.includes(m.type));

  return (
    <Panel title="Console">
      <Toolbar>
        <Button onClick={() => setMessages([])}>Clear</Button>
        <FilterButton type="log" active={filter.includes('log')} />
        <FilterButton type="warn" active={filter.includes('warn')} />
        <FilterButton type="error" active={filter.includes('error')} />
      </Toolbar>

      <MessageList>
        {filtered.map((msg, i) => (
          <ConsoleMessage key={i} message={msg} />
        ))}
      </MessageList>

      <REPLInput onSubmit={(code) => evaluateCode(code)} />
    </Panel>
  );
}

function ConsoleMessage({ message }: { message: ConsoleMessage }) {
  const className = `console-message console-${message.type}`;

  return (
    <div className={className}>
      <span className="timestamp">
        {formatTime(message.timestamp)}
      </span>
      <span className="content">
        {formatArgs(message.args)}
      </span>
      {message.stack && (
        <pre className="stack-trace">{message.stack}</pre>
      )}
    </div>
  );
}
```

## Related Issues

- Frontend Editor Application (new issue)
- Code Editor Integration (new issue)
- Backend Services (build pipeline)
- Build & Export System (new issue)

## References

- [esbuild-wasm](https://esbuild.github.io/getting-started/#wasm)
- [WebContainers](https://webcontainers.io/)
- [StackBlitz](https://stackblitz.com/)
- [CodeSandbox](https://codesandbox.io/)
- [esm.sh](https://esm.sh/) - ESM CDN
- [Sandpack](https://sandpack.codesandbox.io/) - React component for sandboxed code
