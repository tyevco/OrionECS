import * as vscode from 'vscode';
import { EntityInspectorPanel } from '../panels/EntityInspectorPanel';
import { SystemVisualizerPanel } from '../panels/SystemVisualizerPanel';
import type { ECSReferenceProvider } from '../providers/ECSReferenceProvider';
import {
    findComponentReferences,
    isLikelyComponentClass,
    summarizeReferences,
} from '../utils/refactoringUtils';
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

    // Rename Component command - triggers VSCode's rename at cursor
    context.subscriptions.push(
        vscode.commands.registerCommand('orion-ecs.renameComponent', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor');
                return;
            }

            const document = editor.document;
            const position = editor.selection.active;
            const wordRange = document.getWordRangeAtPosition(position);

            if (!wordRange) {
                vscode.window.showWarningMessage('Place cursor on a component name to rename');
                return;
            }

            const word = document.getText(wordRange);

            // Verify it looks like a component name
            if (!/^[A-Z]/.test(word)) {
                vscode.window.showWarningMessage(
                    'Component names should start with an uppercase letter'
                );
                return;
            }

            if (!isLikelyComponentClass(word)) {
                vscode.window.showWarningMessage(
                    `"${word}" doesn't appear to be a component class name`
                );
                return;
            }

            // Trigger VSCode's built-in rename
            await vscode.commands.executeCommand('editor.action.rename');
        })
    );

    // Preview Component References command
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'orion-ecs.previewComponentReferences',
            async (inputComponentName?: string) => {
                // If no component name provided, get it from cursor position
                let targetComponentName = inputComponentName;
                if (!targetComponentName) {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        vscode.window.showWarningMessage('No active editor');
                        return;
                    }

                    const document = editor.document;
                    const position = editor.selection.active;
                    const wordRange = document.getWordRangeAtPosition(position);

                    if (!wordRange) {
                        vscode.window.showWarningMessage(
                            'Place cursor on a component name to preview references'
                        );
                        return;
                    }

                    targetComponentName = document.getText(wordRange);
                }

                // Verify it looks like a component name
                if (!/^[A-Z]/.test(targetComponentName)) {
                    vscode.window.showWarningMessage(
                        'Component names should start with an uppercase letter'
                    );
                    return;
                }

                const componentNameToSearch = targetComponentName;
                outputChannel.appendLine(`Finding references to ${componentNameToSearch}...`);

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: `Finding references to ${componentNameToSearch}`,
                        cancellable: true,
                    },
                    async (_progress, token) => {
                        const references = await findComponentReferences(
                            componentNameToSearch,
                            token
                        );

                        if (token.isCancellationRequested) {
                            return;
                        }

                        if (references.length === 0) {
                            vscode.window.showInformationMessage(
                                `No references found for ${componentNameToSearch}`
                            );
                            return;
                        }

                        const summary = summarizeReferences(references);
                        outputChannel.appendLine(
                            `Found ${references.length} references: ${summary}`
                        );

                        // Group by file for display
                        const byFile = new Map<string, typeof references>();
                        for (const ref of references) {
                            const key = ref.uri.fsPath;
                            if (!byFile.has(key)) {
                                byFile.set(key, []);
                            }
                            const fileRefs = byFile.get(key);
                            if (fileRefs) {
                                fileRefs.push(ref);
                            }
                        }

                        outputChannel.appendLine(`\nReferences by file:`);
                        for (const [file, refs] of byFile) {
                            const shortPath = vscode.workspace.asRelativePath(file);
                            outputChannel.appendLine(`  ${shortPath}: ${refs.length} reference(s)`);
                            for (const ref of refs) {
                                outputChannel.appendLine(
                                    `    Line ${ref.range.start.line + 1}: ${ref.type}`
                                );
                            }
                        }

                        outputChannel.show();

                        const action = await vscode.window.showInformationMessage(
                            `Found ${references.length} references to ${componentNameToSearch}: ${summary}`,
                            'Find in Files',
                            'Close'
                        );

                        if (action === 'Find in Files') {
                            await vscode.commands.executeCommand('workbench.action.findInFiles', {
                                query: componentNameToSearch,
                                triggerSearch: true,
                                isRegex: false,
                                isCaseSensitive: true,
                                matchWholeWord: true,
                            });
                        }
                    }
                );
            }
        )
    );

    // Refactor: Move Component to File command
    context.subscriptions.push(
        vscode.commands.registerCommand('orion-ecs.moveComponentToFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor');
                return;
            }

            const document = editor.document;
            const position = editor.selection.active;
            const line = document.lineAt(position).text;

            // Check if we're on a class definition line
            const classMatch = line.match(/^(?:export\s+)?class\s+(\w+)/);
            if (!classMatch) {
                vscode.window.showWarningMessage(
                    'Place cursor on a component class definition to move it'
                );
                return;
            }

            const className = classMatch[1];
            if (!isLikelyComponentClass(className)) {
                vscode.window.showWarningMessage(
                    `"${className}" doesn't appear to be a component class`
                );
                return;
            }

            // Find the full class definition
            const classStart = position.line;
            let classEnd = classStart;
            let braceCount = 0;
            let foundOpenBrace = false;

            for (let i = classStart; i < document.lineCount; i++) {
                const lineText = document.lineAt(i).text;
                for (const char of lineText) {
                    if (char === '{') {
                        braceCount++;
                        foundOpenBrace = true;
                    } else if (char === '}') {
                        braceCount--;
                    }
                }
                if (foundOpenBrace && braceCount === 0) {
                    classEnd = i;
                    break;
                }
            }

            const classRange = new vscode.Range(
                classStart,
                0,
                classEnd,
                document.lineAt(classEnd).text.length
            );
            const classText = document.getText(classRange);

            // Ask for new file name
            const newFileName = await vscode.window.showInputBox({
                prompt: 'Enter the new file name (without extension)',
                value: className,
                validateInput: (value) => {
                    if (!value) {
                        return 'File name is required';
                    }
                    return null;
                },
            });

            if (!newFileName) {
                return;
            }

            // Determine the directory
            const sourceDir = document.uri.fsPath.substring(
                0,
                document.uri.fsPath.lastIndexOf('/')
            );
            const newFilePath = `${sourceDir}/${newFileName}.ts`;
            const newFileUri = vscode.Uri.file(newFilePath);

            // Create workspace edit
            const workspaceEdit = new vscode.WorkspaceEdit();

            // Create new file with the class
            workspaceEdit.createFile(newFileUri, { overwrite: false, ignoreIfExists: false });
            workspaceEdit.insert(newFileUri, new vscode.Position(0, 0), `export ${classText}\n`);

            // Remove class from original file
            workspaceEdit.delete(document.uri, classRange);

            // Add import to original file
            const importStatement = `import { ${className} } from './${newFileName}';\n`;
            workspaceEdit.insert(document.uri, new vscode.Position(0, 0), importStatement);

            const success = await vscode.workspace.applyEdit(workspaceEdit);

            if (success) {
                outputChannel.appendLine(`Moved ${className} to ${newFileName}.ts`);
                vscode.window.showInformationMessage(`Moved ${className} to ${newFileName}.ts`);
            } else {
                vscode.window.showErrorMessage(`Failed to move ${className}`);
            }
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
