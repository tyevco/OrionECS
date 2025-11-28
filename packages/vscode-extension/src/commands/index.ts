import * as vscode from 'vscode';
import type { ComponentsTreeProvider } from '../views/ComponentsTreeProvider';
import type { EntitiesTreeProvider } from '../views/EntitiesTreeProvider';
import type { SystemsTreeProvider } from '../views/SystemsTreeProvider';

export interface CommandContext {
    componentsProvider: ComponentsTreeProvider;
    systemsProvider: SystemsTreeProvider;
    entitiesProvider: EntitiesTreeProvider;
    outputChannel: vscode.OutputChannel;
}

export function registerCommands(
    context: vscode.ExtensionContext,
    providers: CommandContext
): void {
    const { componentsProvider, systemsProvider, entitiesProvider, outputChannel } = providers;

    // Create Component command
    context.subscriptions.push(
        vscode.commands.registerCommand('orion-ecs.createComponent', async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter component name',
                placeHolder: 'Position',
                validateInput: (value) => {
                    if (!value) {
                        return 'Component name is required';
                    }
                    if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
                        return 'Component name must start with uppercase letter';
                    }
                    return null;
                },
            });

            if (!name) {
                return;
            }

            const properties = await vscode.window.showInputBox({
                prompt: 'Enter properties (e.g., x: number = 0, y: number = 0)',
                placeHolder: 'x: number = 0, y: number = 0',
            });

            const snippet = generateComponentSnippet(name, properties || '');
            await insertSnippet(snippet);

            outputChannel.appendLine(`Created component: ${name}`);
        })
    );

    // Create System command
    context.subscriptions.push(
        vscode.commands.registerCommand('orion-ecs.createSystem', async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter system name',
                placeHolder: 'MovementSystem',
                validateInput: (value) => {
                    if (!value) {
                        return 'System name is required';
                    }
                    return null;
                },
            });

            if (!name) {
                return;
            }

            const components = await vscode.window.showInputBox({
                prompt: 'Enter required components (comma-separated)',
                placeHolder: 'Position, Velocity',
            });

            const priority = await vscode.window.showInputBox({
                prompt: 'Enter priority (higher = runs first)',
                placeHolder: '100',
                value: '100',
            });

            const isFixed = await vscode.window.showQuickPick(['Variable', 'Fixed'], {
                placeHolder: 'Update type',
            });

            const snippet = generateSystemSnippet(
                name,
                components || '',
                priority || '100',
                isFixed === 'Fixed'
            );
            await insertSnippet(snippet);

            outputChannel.appendLine(`Created system: ${name}`);
        })
    );

    // Create Prefab command
    context.subscriptions.push(
        vscode.commands.registerCommand('orion-ecs.createPrefab', async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter prefab name',
                placeHolder: 'Player',
                validateInput: (value) => {
                    if (!value) {
                        return 'Prefab name is required';
                    }
                    return null;
                },
            });

            if (!name) {
                return;
            }

            const components = await vscode.window.showInputBox({
                prompt: 'Enter components (comma-separated)',
                placeHolder: 'Position, Velocity, Health',
            });

            const tags = await vscode.window.showInputBox({
                prompt: 'Enter tags (comma-separated)',
                placeHolder: 'player, active',
            });

            const snippet = generatePrefabSnippet(name, components || '', tags || '');
            await insertSnippet(snippet);

            outputChannel.appendLine(`Created prefab: ${name}`);
        })
    );

    // Show Entity Inspector command
    context.subscriptions.push(
        vscode.commands.registerCommand('orion-ecs.showEntityInspector', async () => {
            const panel = vscode.window.createWebviewPanel(
                'orionEntityInspector',
                'Entity Inspector',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            panel.webview.html = getEntityInspectorHtml();
            outputChannel.appendLine('Opened Entity Inspector');
        })
    );

    // Show System Execution Order command
    context.subscriptions.push(
        vscode.commands.registerCommand('orion-ecs.showSystemExecutionOrder', async () => {
            const panel = vscode.window.createWebviewPanel(
                'orionSystemOrder',
                'System Execution Order',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            panel.webview.html = getSystemExecutionOrderHtml();
            outputChannel.appendLine('Opened System Execution Order view');
        })
    );

    // Open Documentation command
    context.subscriptions.push(
        vscode.commands.registerCommand('orion-ecs.openDocumentation', async () => {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/tyevco/OrionECS'));
        })
    );

    // Refresh Entity Tree command
    context.subscriptions.push(
        vscode.commands.registerCommand('orion-ecs.refreshEntityTree', () => {
            componentsProvider.refresh();
            systemsProvider.refresh();
            entitiesProvider.refresh();
            outputChannel.appendLine('Refreshed all tree views');
        })
    );

    // Find Component References command
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'orion-ecs.findComponentReferences',
            async (componentName: string) => {
                await vscode.commands.executeCommand('workbench.action.findInFiles', {
                    query: componentName,
                    triggerSearch: true,
                    isRegex: false,
                    isCaseSensitive: true,
                    matchWholeWord: true,
                });
            }
        )
    );

    // Show System Info command
    context.subscriptions.push(
        vscode.commands.registerCommand('orion-ecs.showSystemInfo', async (systemName: string) => {
            vscode.window.showInformationMessage(`System: ${systemName}`);
        })
    );

    // Show Prefab Info command
    context.subscriptions.push(
        vscode.commands.registerCommand('orion-ecs.showPrefabInfo', async (prefabName: string) => {
            vscode.window.showInformationMessage(`Prefab: ${prefabName}`);
        })
    );
}

function generateComponentSnippet(name: string, properties: string): string {
    const props = properties
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p);

    if (props.length === 0) {
        return `export class ${name} {
  constructor() {}
}`;
    }

    const constructorParams = props.map((p) => `public ${p}`).join(',\n    ');

    return `export class ${name} {
  constructor(
    ${constructorParams}
  ) {}
}`;
}

function generateSystemSnippet(
    name: string,
    components: string,
    priority: string,
    isFixed: boolean
): string {
    const componentList = components
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c);

    const queryComponents =
        componentList.length > 0 ? componentList.join(', ') : '/* Components */';

    const paramNames = componentList.map((c) => c.toLowerCase()).join(', ');

    return `engine.createSystem('${name}', {
  all: [${queryComponents}]
}, {
  priority: ${priority},
  act: (entity${paramNames ? `, ${paramNames}` : ''}) => {
    // System logic here
  }
}${isFixed ? ', true' : ''});`;
}

function generatePrefabSnippet(name: string, components: string, tags: string): string {
    const componentList = components
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c);
    const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t);

    const componentEntries = componentList.map((c) => `    { type: ${c}, args: [] }`).join(',\n');

    const tagEntries = tagList.map((t) => `'${t}'`).join(', ');

    return `const ${name.toLowerCase()}Prefab: EntityPrefab = {
  name: '${name}',
  components: [
${componentEntries || '    // Add components here'}
  ],
  tags: [${tagEntries || '/* Add tags here */'}]
};

engine.registerPrefab('${name}', ${name.toLowerCase()}Prefab);`;
}

async function insertSnippet(text: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const snippet = new vscode.SnippetString(text);
        await editor.insertSnippet(snippet);
    } else {
        // Create a new untitled document
        const doc = await vscode.workspace.openTextDocument({
            language: 'typescript',
            content: text,
        });
        await vscode.window.showTextDocument(doc);
    }
}

function getEntityInspectorHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Entity Inspector</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 16px;
    }
    h1 { font-size: 1.5em; margin-bottom: 16px; }
    .section { margin-bottom: 24px; }
    .section-title {
      font-weight: bold;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 4px;
    }
    .placeholder {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
    .info-box {
      background: var(--vscode-textBlockQuote-background);
      padding: 12px;
      border-radius: 4px;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <h1>Entity Inspector</h1>

  <div class="info-box">
    <p>The Entity Inspector provides runtime debugging of your ECS world.</p>
    <p>To use this feature, connect your running game to the extension via the OrionECS Debug API.</p>
  </div>

  <div class="section">
    <div class="section-title">Selected Entity</div>
    <p class="placeholder">No entity selected</p>
  </div>

  <div class="section">
    <div class="section-title">Components</div>
    <p class="placeholder">Select an entity to view its components</p>
  </div>

  <div class="section">
    <div class="section-title">Tags</div>
    <p class="placeholder">No tags</p>
  </div>

  <div class="section">
    <div class="section-title">Hierarchy</div>
    <p class="placeholder">No parent/children</p>
  </div>
</body>
</html>`;
}

function getSystemExecutionOrderHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>System Execution Order</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 16px;
    }
    h1 { font-size: 1.5em; margin-bottom: 16px; }
    .section { margin-bottom: 24px; }
    .section-title {
      font-weight: bold;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 4px;
    }
    .placeholder {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
    .info-box {
      background: var(--vscode-textBlockQuote-background);
      padding: 12px;
      border-radius: 4px;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <h1>System Execution Order</h1>

  <div class="info-box">
    <p>This view shows the order in which systems are executed during each engine update.</p>
    <p>Systems are sorted by priority (higher priority runs first).</p>
  </div>

  <div class="section">
    <div class="section-title">Variable Update Systems</div>
    <p class="placeholder">Scan your project to view systems</p>
  </div>

  <div class="section">
    <div class="section-title">Fixed Update Systems</div>
    <p class="placeholder">Scan your project to view systems</p>
  </div>
</body>
</html>`;
}
