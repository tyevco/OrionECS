import * as vscode from 'vscode';

/**
 * Provides rename functionality for ECS component classes.
 * Handles renaming component class definitions and updating all references
 * across the workspace, including:
 * - Class definition and imports
 * - Entity method calls (addComponent, getComponent, hasComponent, removeComponent)
 * - System query definitions (all, any, none arrays)
 * - Prefab definitions
 * - Type annotations
 */
export class ComponentRenameProvider implements vscode.RenameProvider {
    /**
     * Prepares the rename operation by validating the symbol can be renamed
     */
    async prepareRename(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Range | { range: vscode.Range; placeholder: string } | undefined> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        const line = document.lineAt(position).text;

        // Check if this is a component class definition
        if (this.isComponentClassDefinition(line, word)) {
            return { range: wordRange, placeholder: word };
        }

        // Check if this is a component reference in an ECS context
        if (this.isComponentReference(line, word)) {
            return { range: wordRange, placeholder: word };
        }

        return undefined;
    }

    /**
     * Provides the actual rename edits across the workspace
     */
    async provideRenameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string,
        token: vscode.CancellationToken
    ): Promise<vscode.WorkspaceEdit | undefined> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const oldName = document.getText(wordRange);

        // Validate new name
        if (!this.isValidComponentName(newName)) {
            vscode.window.showErrorMessage(
                'Component names must start with an uppercase letter and contain only alphanumeric characters.'
            );
            return undefined;
        }

        const workspaceEdit = new vscode.WorkspaceEdit();

        // Find all TypeScript/JavaScript files in the workspace
        const files = await vscode.workspace.findFiles(
            '**/*.{ts,tsx,js,jsx}',
            '**/node_modules/**'
        );

        for (const file of files) {
            if (token.isCancellationRequested) {
                return undefined;
            }

            try {
                const doc = await vscode.workspace.openTextDocument(file);
                const edits = this.findComponentReferences(doc, oldName, newName);

                for (const edit of edits) {
                    workspaceEdit.replace(file, edit.range, edit.newText);
                }
            } catch {
                // Skip files that can't be opened
            }
        }

        return workspaceEdit;
    }

    /**
     * Finds all references to a component in a document
     */
    private findComponentReferences(
        document: vscode.TextDocument,
        oldName: string,
        newName: string
    ): { range: vscode.Range; newText: string }[] {
        const edits: { range: vscode.Range; newText: string }[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];

            // Find all occurrences of the component name in this line
            const lineEdits = this.findLineReferences(line, lineIndex, oldName, newName);
            edits.push(...lineEdits);
        }

        return edits;
    }

    /**
     * Finds component references in a single line
     */
    private findLineReferences(
        line: string,
        lineIndex: number,
        oldName: string,
        newName: string
    ): { range: vscode.Range; newText: string }[] {
        const edits: { range: vscode.Range; newText: string }[] = [];

        // Create pattern to match whole word only
        const pattern = new RegExp(`\\b${this.escapeRegex(oldName)}\\b`, 'g');
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(line)) !== null) {
            const startPos = match.index;
            const context = this.getContext(line, startPos);

            // Only rename if it's in a valid ECS context
            if (this.isValidContext(context, line, oldName)) {
                edits.push({
                    range: new vscode.Range(
                        lineIndex,
                        startPos,
                        lineIndex,
                        startPos + oldName.length
                    ),
                    newText: newName,
                });
            }
        }

        return edits;
    }

    /**
     * Gets the context around a position in the line
     */
    private getContext(line: string, position: number): string {
        // Get up to 50 characters before the position
        const start = Math.max(0, position - 50);
        return line.substring(start, position);
    }

    /**
     * Checks if the context is valid for component renaming
     */
    private isValidContext(context: string, line: string, componentName: string): boolean {
        // Check for class definition
        if (line.match(new RegExp(`class\\s+${this.escapeRegex(componentName)}\\b`))) {
            return true;
        }

        // Check for import statement
        if (line.includes('import') && line.includes(componentName)) {
            return true;
        }

        // Check for entity method calls
        const entityMethods = [
            'addComponent',
            'getComponent',
            'hasComponent',
            'removeComponent',
            'has',
            'get',
            'add',
        ];
        for (const method of entityMethods) {
            if (context.includes(`.${method}(`) || context.includes(`.${method}<`)) {
                return true;
            }
        }

        // Check for query definitions (all, any, none arrays)
        if (/(?:all|any|none)\s*:\s*\[/.test(context) || /\[\s*$/.test(context)) {
            // Check if we're inside a query array
            const beforeContext = line.substring(0, line.indexOf(componentName));
            if (/(?:all|any|none)\s*:\s*\[[^\]]*$/.test(beforeContext)) {
                return true;
            }
        }

        // Check for prefab component definitions
        if (/type\s*:\s*$/.test(context)) {
            return true;
        }

        // Check for type annotations
        if (context.includes(':') && !context.includes('=')) {
            return true;
        }

        // Check for generic type parameters
        if (/<\s*$/.test(context) || /<[^>]*,\s*$/.test(context)) {
            return true;
        }

        // Check for createSystem query
        if (line.includes('createSystem') && line.includes(componentName)) {
            return true;
        }

        // Check for singleton methods
        if (
            context.includes('.setSingleton(') ||
            context.includes('.getSingleton(') ||
            context.includes('.hasSingleton(')
        ) {
            return true;
        }

        // Check for export statements
        if (line.match(/export\s*{[^}]*/) && line.includes(componentName)) {
            return true;
        }

        return false;
    }

    /**
     * Checks if the line contains a component class definition
     */
    private isComponentClassDefinition(line: string, word: string): boolean {
        const classMatch = line.match(/^(?:export\s+)?class\s+(\w+)/);
        if (classMatch && classMatch[1] === word) {
            return this.isLikelyComponentClass(word);
        }
        return false;
    }

    /**
     * Checks if the word is a component reference in an ECS context
     */
    private isComponentReference(line: string, word: string): boolean {
        // Must start with uppercase (component naming convention)
        if (!/^[A-Z]/.test(word)) {
            return false;
        }

        // Check for entity method calls
        if (/\.(add|get|has|remove)Component\s*[(<]/.test(line)) {
            return true;
        }

        // Check for query definitions
        if (/(?:all|any|none)\s*:\s*\[/.test(line)) {
            return true;
        }

        // Check for prefab type definitions
        if (/type\s*:\s*\w+/.test(line)) {
            return true;
        }

        // Check for imports
        if (/import\s*{[^}]*}\s*from/.test(line)) {
            return true;
        }

        // Check for singleton methods
        if (/\.(set|get|has)Singleton\s*[(<]/.test(line)) {
            return true;
        }

        return false;
    }

    /**
     * Checks if the class name is likely a component (not a system, manager, etc.)
     */
    private isLikelyComponentClass(className: string): boolean {
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

    /**
     * Validates that the new name is a valid component name
     */
    private isValidComponentName(name: string): boolean {
        return /^[A-Z][a-zA-Z0-9]*$/.test(name);
    }

    /**
     * Escapes special regex characters
     */
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
