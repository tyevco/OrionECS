import * as vscode from 'vscode';

/**
 * Reference types for component usage tracking
 */
export enum ComponentReferenceType {
    ClassDefinition = 'class_definition',
    Import = 'import',
    EntityAddComponent = 'entity_add_component',
    EntityGetComponent = 'entity_get_component',
    EntityHasComponent = 'entity_has_component',
    EntityRemoveComponent = 'entity_remove_component',
    SystemQueryAll = 'system_query_all',
    SystemQueryAny = 'system_query_any',
    SystemQueryNone = 'system_query_none',
    PrefabDefinition = 'prefab_definition',
    SingletonSet = 'singleton_set',
    SingletonGet = 'singleton_get',
    TypeAnnotation = 'type_annotation',
    GenericParameter = 'generic_parameter',
    Export = 'export',
}

/**
 * Represents a reference to a component in the codebase
 */
export interface ComponentReference {
    type: ComponentReferenceType;
    uri: vscode.Uri;
    range: vscode.Range;
    componentName: string;
    lineText: string;
}

/**
 * Finds all references to a component across the workspace
 */
export async function findComponentReferences(
    componentName: string,
    cancellationToken?: vscode.CancellationToken
): Promise<ComponentReference[]> {
    const references: ComponentReference[] = [];
    const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx}', '**/node_modules/**');

    for (const file of files) {
        if (cancellationToken?.isCancellationRequested) {
            break;
        }

        try {
            const document = await vscode.workspace.openTextDocument(file);
            const fileRefs = findReferencesInDocument(document, componentName);
            references.push(...fileRefs);
        } catch {
            // Skip files that can't be opened
        }
    }

    return references;
}

/**
 * Finds all references to a component in a single document
 */
export function findReferencesInDocument(
    document: vscode.TextDocument,
    componentName: string
): ComponentReference[] {
    const references: ComponentReference[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    const escapedName = escapeRegex(componentName);
    const pattern = new RegExp(`\\b${escapedName}\\b`, 'g');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        let match: RegExpExecArray | null;

        pattern.lastIndex = 0; // Reset regex state
        while ((match = pattern.exec(line)) !== null) {
            const refType = classifyReference(line, match.index, componentName);

            if (refType) {
                references.push({
                    type: refType,
                    uri: document.uri,
                    range: new vscode.Range(
                        lineIndex,
                        match.index,
                        lineIndex,
                        match.index + componentName.length
                    ),
                    componentName,
                    lineText: line,
                });
            }
        }
    }

    return references;
}

/**
 * Classifies the type of component reference based on context
 */
function classifyReference(
    line: string,
    position: number,
    componentName: string
): ComponentReferenceType | null {
    const beforeText = line.substring(0, position);
    const afterText = line.substring(position + componentName.length);

    // Class definition
    if (new RegExp(`class\\s+${escapeRegex(componentName)}\\b`).test(line)) {
        return ComponentReferenceType.ClassDefinition;
    }

    // Import statement
    if (/import\s*{/.test(line) || /import\s+\w+/.test(line)) {
        return ComponentReferenceType.Import;
    }

    // Export statement
    if (/export\s*{/.test(line)) {
        return ComponentReferenceType.Export;
    }

    // Entity methods
    if (/\.addComponent\s*[(<]/.test(beforeText) || afterText.startsWith(')')) {
        if (/\.addComponent\s*\(\s*$/.test(beforeText)) {
            return ComponentReferenceType.EntityAddComponent;
        }
    }

    if (/\.getComponent\s*[(<]/.test(beforeText)) {
        return ComponentReferenceType.EntityGetComponent;
    }

    if (/\.hasComponent\s*[(<]/.test(beforeText)) {
        return ComponentReferenceType.EntityHasComponent;
    }

    if (/\.removeComponent\s*[(<]/.test(beforeText)) {
        return ComponentReferenceType.EntityRemoveComponent;
    }

    // System query definitions
    if (/all\s*:\s*\[[^\]]*$/.test(beforeText)) {
        return ComponentReferenceType.SystemQueryAll;
    }

    if (/any\s*:\s*\[[^\]]*$/.test(beforeText)) {
        return ComponentReferenceType.SystemQueryAny;
    }

    if (/none\s*:\s*\[[^\]]*$/.test(beforeText)) {
        return ComponentReferenceType.SystemQueryNone;
    }

    // Prefab definition (type: ComponentName)
    if (/type\s*:\s*$/.test(beforeText)) {
        return ComponentReferenceType.PrefabDefinition;
    }

    // Singleton methods
    if (/\.setSingleton\s*[(<]/.test(beforeText)) {
        return ComponentReferenceType.SingletonSet;
    }

    if (/\.getSingleton\s*[(<]/.test(beforeText)) {
        return ComponentReferenceType.SingletonGet;
    }

    // Generic type parameters
    if (/<\s*$/.test(beforeText) || /<[^>]*,\s*$/.test(beforeText)) {
        return ComponentReferenceType.GenericParameter;
    }

    // Type annotation
    if (/:\s*$/.test(beforeText) && !/=/.test(beforeText)) {
        return ComponentReferenceType.TypeAnnotation;
    }

    // If component appears in system createSystem call
    if (line.includes('createSystem')) {
        return ComponentReferenceType.SystemQueryAll;
    }

    return null;
}

/**
 * Creates workspace edits to rename a component
 */
export async function createRenameEdits(
    oldName: string,
    newName: string,
    references: ComponentReference[]
): Promise<vscode.WorkspaceEdit> {
    const workspaceEdit = new vscode.WorkspaceEdit();

    for (const ref of references) {
        workspaceEdit.replace(ref.uri, ref.range, newName);
    }

    return workspaceEdit;
}

/**
 * Groups references by file URI
 */
export function groupReferencesByFile(
    references: ComponentReference[]
): Map<string, ComponentReference[]> {
    const grouped = new Map<string, ComponentReference[]>();

    for (const ref of references) {
        const key = ref.uri.toString();
        const existing = grouped.get(key) || [];
        existing.push(ref);
        grouped.set(key, existing);
    }

    return grouped;
}

/**
 * Gets a summary of component references
 */
export function summarizeReferences(references: ComponentReference[]): string {
    const counts: Record<string, number> = {};

    for (const ref of references) {
        counts[ref.type] = (counts[ref.type] || 0) + 1;
    }

    const parts: string[] = [];

    if (counts[ComponentReferenceType.ClassDefinition]) {
        parts.push(`${counts[ComponentReferenceType.ClassDefinition]} definition(s)`);
    }
    if (counts[ComponentReferenceType.Import]) {
        parts.push(`${counts[ComponentReferenceType.Import]} import(s)`);
    }
    if (counts[ComponentReferenceType.Export]) {
        parts.push(`${counts[ComponentReferenceType.Export]} export(s)`);
    }

    const entityMethods =
        (counts[ComponentReferenceType.EntityAddComponent] || 0) +
        (counts[ComponentReferenceType.EntityGetComponent] || 0) +
        (counts[ComponentReferenceType.EntityHasComponent] || 0) +
        (counts[ComponentReferenceType.EntityRemoveComponent] || 0);
    if (entityMethods) {
        parts.push(`${entityMethods} entity method(s)`);
    }

    const queryRefs =
        (counts[ComponentReferenceType.SystemQueryAll] || 0) +
        (counts[ComponentReferenceType.SystemQueryAny] || 0) +
        (counts[ComponentReferenceType.SystemQueryNone] || 0);
    if (queryRefs) {
        parts.push(`${queryRefs} system query/queries`);
    }

    if (counts[ComponentReferenceType.PrefabDefinition]) {
        parts.push(`${counts[ComponentReferenceType.PrefabDefinition]} prefab(s)`);
    }

    const singletonRefs =
        (counts[ComponentReferenceType.SingletonSet] || 0) +
        (counts[ComponentReferenceType.SingletonGet] || 0);
    if (singletonRefs) {
        parts.push(`${singletonRefs} singleton reference(s)`);
    }

    return parts.join(', ');
}

/**
 * Validates a component name
 */
export function isValidComponentName(name: string): boolean {
    return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

/**
 * Determines if a class name is likely a component (not a system, manager, etc.)
 */
export function isLikelyComponentClass(className: string): boolean {
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
 * Escapes special regex characters
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Analyzes imports in a file to determine available components
 */
export async function analyzeFileImports(
    document: vscode.TextDocument
): Promise<{ name: string; source: string }[]> {
    const imports: { name: string; source: string }[] = [];
    const text = document.getText();

    // Match import { A, B, C } from 'source'
    const namedImportPattern = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;

    while ((match = namedImportPattern.exec(text)) !== null) {
        const names = match[1].split(',').map(
            (n) =>
                n
                    .trim()
                    .split(/\s+as\s+/)
                    .pop()
                    ?.trim() || ''
        );
        const source = match[2];

        for (const name of names) {
            if (name && /^[A-Z]/.test(name) && isLikelyComponentClass(name)) {
                imports.push({ name, source });
            }
        }
    }

    // Match import DefaultExport from 'source'
    const defaultImportPattern = /import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g;
    while ((match = defaultImportPattern.exec(text)) !== null) {
        const name = match[1];
        const source = match[2];

        if (/^[A-Z]/.test(name) && isLikelyComponentClass(name)) {
            imports.push({ name, source });
        }
    }

    return imports;
}

/**
 * Gets all component classes defined in a file
 */
export function getComponentDefinitions(
    document: vscode.TextDocument
): { name: string; line: number }[] {
    const components: { name: string; line: number }[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^(?:export\s+)?class\s+(\w+)/);

        if (match && isLikelyComponentClass(match[1])) {
            components.push({ name: match[1], line: i });
        }
    }

    return components;
}
