import * as vscode from 'vscode';

/**
 * Provides code actions for extracting properties from a component into a new component.
 * Features:
 * - Extract selected properties to a new component class
 * - Auto-generate component class boilerplate
 * - Update entity creation and system logic
 */
export class ExtractComponentCodeActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [vscode.CodeActionKind.RefactorExtract];

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        _context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.CodeAction[] | undefined {
        // Only provide actions if there's a selection
        if (range.isEmpty) {
            return undefined;
        }

        const selectedText = document.getText(range);
        const componentInfo = this.getContainingComponent(document, range);

        if (!componentInfo) {
            return undefined;
        }

        // Check if the selection contains extractable properties
        const properties = this.parseSelectedProperties(selectedText);
        if (properties.length === 0) {
            return undefined;
        }

        const actions: vscode.CodeAction[] = [];

        // Create the extract component action
        const extractAction = new vscode.CodeAction(
            `Extract ${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} to new component`,
            vscode.CodeActionKind.RefactorExtract
        );

        extractAction.command = {
            title: 'Extract Component',
            command: 'orion-ecs.extractComponent',
            arguments: [document.uri, range, componentInfo.name, componentInfo.range, properties],
        };

        actions.push(extractAction);

        return actions;
    }

    /**
     * Gets information about the component class containing the selection
     */
    private getContainingComponent(
        document: vscode.TextDocument,
        range: vscode.Range
    ): { name: string; range: vscode.Range } | undefined {
        const text = document.getText();
        const lines = text.split('\n');

        // Search backwards from the selection to find the class definition
        for (let i = range.start.line; i >= 0; i--) {
            const line = lines[i];
            const classMatch = line.match(/^(?:export\s+)?class\s+(\w+)/);

            if (classMatch) {
                const className = classMatch[1];

                // Verify it's likely a component
                if (this.isLikelyComponent(className)) {
                    // Find the end of the class
                    const classEnd = this.findClassEnd(lines, i);
                    return {
                        name: className,
                        range: new vscode.Range(i, 0, classEnd, lines[classEnd].length),
                    };
                }
            }
        }

        return undefined;
    }

    /**
     * Finds the end line of a class definition
     */
    private findClassEnd(lines: string[], startLine: number): number {
        let braceCount = 0;
        let foundOpenBrace = false;

        for (let i = startLine; i < lines.length; i++) {
            for (const char of lines[i]) {
                if (char === '{') {
                    braceCount++;
                    foundOpenBrace = true;
                } else if (char === '}') {
                    braceCount--;
                }
            }

            if (foundOpenBrace && braceCount === 0) {
                return i;
            }
        }

        return lines.length - 1;
    }

    /**
     * Parses selected text to extract property definitions
     */
    private parseSelectedProperties(
        text: string
    ): { name: string; type: string; defaultValue?: string; modifier?: string }[] {
        const properties: {
            name: string;
            type: string;
            defaultValue?: string;
            modifier?: string;
        }[] = [];
        const lines = text.split('\n');

        for (const line of lines) {
            // Match constructor parameter properties
            const paramMatch = line.match(
                /(public|private|protected|readonly)\s+(\w+)\s*(?::\s*([^=,)]+))?\s*(?:=\s*([^,)]+))?/
            );

            if (paramMatch) {
                properties.push({
                    modifier: paramMatch[1],
                    name: paramMatch[2],
                    type: paramMatch[3]?.trim() || 'any',
                    defaultValue: paramMatch[4]?.trim(),
                });
                continue;
            }

            // Match class property declarations
            const propMatch = line.match(/^\s*(\w+)\s*(?::\s*([^=;]+))?\s*(?:=\s*([^;]+))?;/);

            if (propMatch && !line.includes('constructor')) {
                properties.push({
                    name: propMatch[1],
                    type: propMatch[2]?.trim() || 'any',
                    defaultValue: propMatch[3]?.trim(),
                });
            }
        }

        return properties;
    }

    /**
     * Determines if a class name is likely a component
     */
    private isLikelyComponent(className: string): boolean {
        const nonComponentPatterns = [
            /System$/,
            /Manager$/,
            /Service$/,
            /Controller$/,
            /Provider$/,
            /Factory$/,
            /Builder$/,
            /Handler$/,
            /Plugin$/,
            /Engine$/,
            /Query$/,
        ];

        for (const pattern of nonComponentPatterns) {
            if (pattern.test(className)) {
                return false;
            }
        }

        return true;
    }
}

/**
 * Generates a new component class from extracted properties
 */
export function generateExtractedComponent(
    name: string,
    properties: { name: string; type: string; defaultValue?: string; modifier?: string }[]
): string {
    if (properties.length === 0) {
        return `export class ${name} {
  constructor() {}
}`;
    }

    const constructorParams = properties
        .map((p) => {
            const modifier = p.modifier || 'public';
            const type = p.type !== 'any' ? `: ${p.type}` : '';
            const defaultVal = p.defaultValue ? ` = ${p.defaultValue}` : '';
            return `    ${modifier} ${p.name}${type}${defaultVal}`;
        })
        .join(',\n');

    return `export class ${name} {
  constructor(
${constructorParams}
  ) {}
}`;
}

/**
 * Registers the extract component command
 */
export function registerExtractComponentCommand(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'orion-ecs.extractComponent',
            async (
                documentUri: vscode.Uri,
                selectionRange: vscode.Range,
                sourceComponentName: string,
                sourceComponentRange: vscode.Range,
                properties: {
                    name: string;
                    type: string;
                    defaultValue?: string;
                    modifier?: string;
                }[]
            ) => {
                // Prompt for new component name
                const newName = await vscode.window.showInputBox({
                    prompt: 'Enter name for the new component',
                    placeHolder: 'NewComponent',
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

                if (!newName) {
                    return;
                }

                // Ask where to place the new component
                const placement = await vscode.window.showQuickPick(
                    [
                        { label: 'Same file', description: 'Add above the current component' },
                        { label: 'New file', description: 'Create a new file for the component' },
                    ],
                    { placeHolder: 'Where should the new component be created?' }
                );

                if (!placement) {
                    return;
                }

                // Open document to ensure it's accessible for edits
                await vscode.workspace.openTextDocument(documentUri);
                const workspaceEdit = new vscode.WorkspaceEdit();
                const newComponentCode = generateExtractedComponent(newName, properties);

                if (placement.label === 'Same file') {
                    // Insert new component above the source component
                    const insertPosition = new vscode.Position(sourceComponentRange.start.line, 0);
                    workspaceEdit.insert(documentUri, insertPosition, newComponentCode + '\n\n');
                } else {
                    // Create a new file
                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
                    if (!workspaceFolder) {
                        vscode.window.showErrorMessage('Could not determine workspace folder');
                        return;
                    }

                    // Determine the directory of the source file
                    const sourceDir = documentUri.fsPath.substring(
                        0,
                        documentUri.fsPath.lastIndexOf('/')
                    );
                    const newFilePath = `${sourceDir}/${newName}.ts`;
                    const newFileUri = vscode.Uri.file(newFilePath);

                    workspaceEdit.createFile(newFileUri, {
                        overwrite: false,
                        ignoreIfExists: true,
                    });
                    workspaceEdit.insert(newFileUri, new vscode.Position(0, 0), newComponentCode);

                    // Add import to the source file
                    const importStatement = `import { ${newName} } from './${newName}';\n`;
                    workspaceEdit.insert(documentUri, new vscode.Position(0, 0), importStatement);
                }

                // Remove the extracted properties from the source component
                workspaceEdit.delete(documentUri, selectionRange);

                // Apply the edits
                const success = await vscode.workspace.applyEdit(workspaceEdit);

                if (success) {
                    outputChannel.appendLine(
                        `Extracted ${properties.length} properties from ${sourceComponentName} to ${newName}`
                    );

                    // Offer to update references
                    const updateRefs = await vscode.window.showInformationMessage(
                        `Component "${newName}" created. Would you like to find and update entity references?`,
                        'Find References',
                        'Skip'
                    );

                    if (updateRefs === 'Find References') {
                        // Search for places where the source component is used
                        await vscode.commands.executeCommand('workbench.action.findInFiles', {
                            query: `addComponent\\s*\\(\\s*${sourceComponentName}`,
                            triggerSearch: true,
                            isRegex: true,
                        });
                    }
                } else {
                    vscode.window.showErrorMessage('Failed to extract component');
                }
            }
        )
    );
}
