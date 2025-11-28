import * as vscode from 'vscode';
import { EntityInspectorPanel } from '../panels/EntityInspectorPanel';
import { SystemVisualizerPanel } from '../panels/SystemVisualizerPanel';
import type { ECSReferenceProvider } from '../providers/ECSReferenceProvider';
import type { ComponentsTreeProvider } from '../views/ComponentsTreeProvider';
import type { EntitiesTreeProvider } from '../views/EntitiesTreeProvider';
import type { SystemsTreeProvider } from '../views/SystemsTreeProvider';

export interface CommandContext {
    componentsProvider: ComponentsTreeProvider;
    systemsProvider: SystemsTreeProvider;
    entitiesProvider: EntitiesTreeProvider;
    referenceProvider: ECSReferenceProvider;
    outputChannel: vscode.OutputChannel;
    extensionUri: vscode.Uri;
}

export function registerCommands(
    context: vscode.ExtensionContext,
    providers: CommandContext
): void {
    const {
        componentsProvider,
        systemsProvider,
        entitiesProvider,
        referenceProvider,
        outputChannel,
    } = providers;

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
            EntityInspectorPanel.createOrShow(providers.extensionUri, outputChannel);
            outputChannel.appendLine('Opened Entity Inspector');
        })
    );

    // Show System Execution Order command (now System Visualizer)
    context.subscriptions.push(
        vscode.commands.registerCommand('orion-ecs.showSystemExecutionOrder', async () => {
            SystemVisualizerPanel.createOrShow(providers.extensionUri, outputChannel);
            outputChannel.appendLine('Opened System Visualizer');
        })
    );

    // Show System Visualizer command (alias)
    context.subscriptions.push(
        vscode.commands.registerCommand('orion-ecs.showSystemVisualizer', async () => {
            SystemVisualizerPanel.createOrShow(providers.extensionUri, outputChannel);
            outputChannel.appendLine('Opened System Visualizer');
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
                try {
                    const locations = await referenceProvider.findComponentReferences(
                        componentName,
                        true
                    );

                    if (locations.length === 0) {
                        vscode.window.showInformationMessage(
                            `No references found for component: ${componentName}`
                        );
                        return;
                    }

                    // Show results in peek view if we have a current editor
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        await vscode.commands.executeCommand(
                            'editor.action.showReferences',
                            editor.document.uri,
                            editor.selection.active,
                            locations
                        );
                    } else {
                        // Fallback to opening first location
                        const firstLocation = locations[0];
                        const doc = await vscode.workspace.openTextDocument(firstLocation.uri);
                        await vscode.window.showTextDocument(doc, {
                            selection: firstLocation.range,
                        });
                        vscode.window.showInformationMessage(
                            `Found ${locations.length} references to ${componentName}`
                        );
                    }

                    outputChannel.appendLine(
                        `Found ${locations.length} references to component: ${componentName}`
                    );
                } catch (error) {
                    outputChannel.appendLine(`Error finding references: ${error}`);
                    vscode.window.showErrorMessage(`Error finding references for ${componentName}`);
                }
            }
        )
    );

    // Find System References command
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'orion-ecs.findSystemReferences',
            async (systemName: string) => {
                try {
                    const locations = await referenceProvider.findSystemReferences(
                        systemName,
                        true
                    );

                    if (locations.length === 0) {
                        vscode.window.showInformationMessage(
                            `No references found for system: ${systemName}`
                        );
                        return;
                    }

                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        await vscode.commands.executeCommand(
                            'editor.action.showReferences',
                            editor.document.uri,
                            editor.selection.active,
                            locations
                        );
                    } else {
                        const firstLocation = locations[0];
                        const doc = await vscode.workspace.openTextDocument(firstLocation.uri);
                        await vscode.window.showTextDocument(doc, {
                            selection: firstLocation.range,
                        });
                        vscode.window.showInformationMessage(
                            `Found ${locations.length} references to ${systemName}`
                        );
                    }

                    outputChannel.appendLine(
                        `Found ${locations.length} references to system: ${systemName}`
                    );
                } catch (error) {
                    outputChannel.appendLine(`Error finding references: ${error}`);
                    vscode.window.showErrorMessage(`Error finding references for ${systemName}`);
                }
            }
        )
    );

    // Find Prefab References command
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'orion-ecs.findPrefabReferences',
            async (prefabName: string) => {
                try {
                    const locations = await referenceProvider.findPrefabReferences(
                        prefabName,
                        true
                    );

                    if (locations.length === 0) {
                        vscode.window.showInformationMessage(
                            `No references found for prefab: ${prefabName}`
                        );
                        return;
                    }

                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        await vscode.commands.executeCommand(
                            'editor.action.showReferences',
                            editor.document.uri,
                            editor.selection.active,
                            locations
                        );
                    } else {
                        const firstLocation = locations[0];
                        const doc = await vscode.workspace.openTextDocument(firstLocation.uri);
                        await vscode.window.showTextDocument(doc, {
                            selection: firstLocation.range,
                        });
                        vscode.window.showInformationMessage(
                            `Found ${locations.length} references to ${prefabName}`
                        );
                    }

                    outputChannel.appendLine(
                        `Found ${locations.length} references to prefab: ${prefabName}`
                    );
                } catch (error) {
                    outputChannel.appendLine(`Error finding references: ${error}`);
                    vscode.window.showErrorMessage(`Error finding references for ${prefabName}`);
                }
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
