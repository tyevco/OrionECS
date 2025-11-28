import * as vscode from 'vscode';

export interface ComponentInfo {
    name: string;
    filePath: string;
    line: number;
    properties: PropertyInfo[];
    isTagComponent: boolean;
}

export interface PropertyInfo {
    name: string;
    type: string;
    defaultValue?: string;
}

export interface SystemInfo {
    name: string;
    filePath: string;
    line: number;
    queryComponents: string[];
    priority?: number;
    isFixedUpdate: boolean;
    tags: string[];
}

export interface PrefabInfo {
    name: string;
    filePath: string;
    line: number;
    components: string[];
    tags: string[];
}

/**
 * Scans the workspace for ECS components
 */
export async function scanForComponents(): Promise<ComponentInfo[]> {
    const components: ComponentInfo[] = [];

    try {
        const files = await vscode.workspace.findFiles('**/*.{ts,js}', '**/node_modules/**');

        for (const file of files) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const text = document.getText();

                // Find class definitions that look like components
                const classMatches = findComponentClasses(text, file.fsPath);
                components.push(...classMatches);

                // Find tag components
                const tagMatches = findTagComponents(text, file.fsPath);
                components.push(...tagMatches);
            } catch {
                // Skip files that can't be read
            }
        }
    } catch {
        // Return empty if workspace scan fails
    }

    return components;
}

/**
 * Finds component class definitions in text
 */
function findComponentClasses(text: string, filePath: string): ComponentInfo[] {
    const components: ComponentInfo[] = [];
    const lines = text.split('\n');

    // Look for class definitions that appear to be components
    // Heuristic: classes with constructor parameters or simple data properties
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^(?:export\s+)?class\s+(\w+)/);

        if (match) {
            const className = match[1];

            // Skip common non-component class names
            if (isLikelyComponent(className)) {
                const properties = extractProperties(lines, i);

                components.push({
                    name: className,
                    filePath,
                    line: i + 1,
                    properties,
                    isTagComponent: false,
                });
            }
        }
    }

    return components;
}

/**
 * Finds tag component definitions in text
 */
function findTagComponents(text: string, filePath: string): ComponentInfo[] {
    const components: ComponentInfo[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/createTagComponent\s*\(\s*['"`](\w+)['"`]\s*\)/);

        if (match) {
            components.push({
                name: match[1],
                filePath,
                line: i + 1,
                properties: [],
                isTagComponent: true,
            });
        }
    }

    return components;
}

/**
 * Determines if a class name is likely a component
 */
function isLikelyComponent(className: string): boolean {
    // Skip common non-component patterns
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
 * Extracts properties from a class definition
 */
function extractProperties(lines: string[], classLineIndex: number): PropertyInfo[] {
    const properties: PropertyInfo[] = [];
    let braceCount = 0;
    let inConstructor = false;
    let foundOpenBrace = false;

    for (let i = classLineIndex; i < lines.length && i < classLineIndex + 50; i++) {
        const line = lines[i];

        // Count braces
        for (const char of line) {
            if (char === '{') {
                braceCount++;
                foundOpenBrace = true;
            } else if (char === '}') {
                braceCount--;
            }
        }

        // Check if we've exited the class
        if (foundOpenBrace && braceCount === 0) {
            break;
        }

        // Look for constructor parameters with public/private/readonly
        if (line.includes('constructor')) {
            inConstructor = true;
        }

        if (inConstructor) {
            // Match constructor parameter properties
            const paramMatch = line.match(
                /(?:public|private|protected|readonly)\s+(\w+)\s*(?::\s*(\w+(?:<[^>]+>)?))?\s*(?:=\s*([^,)]+))?/g
            );

            if (paramMatch) {
                for (const param of paramMatch) {
                    const parts = param.match(
                        /(?:public|private|protected|readonly)\s+(\w+)\s*(?::\s*(\w+(?:<[^>]+>)?))?\s*(?:=\s*(.+))?/
                    );
                    if (parts) {
                        properties.push({
                            name: parts[1],
                            type: parts[2] || 'any',
                            defaultValue: parts[3]?.trim(),
                        });
                    }
                }
            }

            // Check if constructor ends
            if (line.includes(')') && braceCount <= 2) {
                inConstructor = false;
            }
        }

        // Look for class property declarations
        const propMatch = line.match(/^\s*(\w+)\s*:\s*(\w+(?:<[^>]+>)?)\s*(?:=\s*(.+))?;/);
        if (propMatch && !inConstructor) {
            properties.push({
                name: propMatch[1],
                type: propMatch[2],
                defaultValue: propMatch[3]?.trim(),
            });
        }
    }

    return properties;
}

/**
 * Scans the workspace for ECS systems
 */
export async function scanForSystems(): Promise<SystemInfo[]> {
    const systems: SystemInfo[] = [];

    try {
        const files = await vscode.workspace.findFiles('**/*.{ts,js}', '**/node_modules/**');

        for (const file of files) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const text = document.getText();
                const lines = text.split('\n');

                // Find createSystem calls
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];

                    if (line.includes('.createSystem')) {
                        const systemInfo = parseSystemDefinition(lines, i, file.fsPath);
                        if (systemInfo) {
                            systems.push(systemInfo);
                        }
                    }
                }
            } catch {
                // Skip files that can't be read
            }
        }
    } catch {
        // Return empty if workspace scan fails
    }

    return systems;
}

/**
 * Parses a system definition from lines
 */
function parseSystemDefinition(
    lines: string[],
    startLine: number,
    filePath: string
): SystemInfo | null {
    // Gather lines until we have the full createSystem call
    let fullText = '';
    let parenCount = 0;
    let started = false;

    for (let i = startLine; i < lines.length && i < startLine + 30; i++) {
        fullText += lines[i] + '\n';

        for (const char of lines[i]) {
            if (char === '(') {
                parenCount++;
                started = true;
            } else if (char === ')') {
                parenCount--;
            }
        }

        // Check if we've completed the call
        if (started && parenCount === 0) {
            break;
        }
    }

    // Extract system name
    const nameMatch = fullText.match(/\.createSystem\s*\(\s*['"`](\w+)['"`]/);
    if (!nameMatch) {
        return null;
    }

    const name = nameMatch[1];

    // Extract query components
    const queryComponents: string[] = [];
    const allMatch = fullText.match(/all\s*:\s*\[([^\]]*)\]/);
    if (allMatch) {
        const components = allMatch[1].match(/\w+/g);
        if (components) {
            queryComponents.push(...components);
        }
    }

    // Extract priority
    let priority: number | undefined;
    const priorityMatch = fullText.match(/priority\s*:\s*(\d+)/);
    if (priorityMatch) {
        priority = parseInt(priorityMatch[1], 10);
    }

    // Check if fixed update (last boolean parameter)
    const isFixedUpdate = fullText.includes(', true)') || fullText.includes(',true)');

    // Extract tags
    const tags: string[] = [];
    const tagsMatch = fullText.match(/tags\s*:\s*\[([^\]]*)\]/);
    if (tagsMatch) {
        const tagStrings = tagsMatch[1].match(/['"`](\w+)['"`]/g);
        if (tagStrings) {
            tags.push(...tagStrings.map((t) => t.replace(/['"`]/g, '')));
        }
    }

    return {
        name,
        filePath,
        line: startLine + 1,
        queryComponents,
        priority,
        isFixedUpdate,
        tags,
    };
}

/**
 * Scans the workspace for entity prefabs
 */
export async function scanForPrefabs(): Promise<PrefabInfo[]> {
    const prefabs: PrefabInfo[] = [];

    try {
        const files = await vscode.workspace.findFiles('**/*.{ts,js}', '**/node_modules/**');

        for (const file of files) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const text = document.getText();
                const lines = text.split('\n');

                // Find registerPrefab calls
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];

                    if (line.includes('.registerPrefab')) {
                        const prefabInfo = parsePrefabDefinition(lines, i, file.fsPath);
                        if (prefabInfo) {
                            prefabs.push(prefabInfo);
                        }
                    }

                    // Also look for EntityPrefab type annotations
                    if (line.includes(': EntityPrefab')) {
                        const prefabInfo = parsePrefabObject(lines, i, file.fsPath);
                        if (prefabInfo) {
                            prefabs.push(prefabInfo);
                        }
                    }
                }
            } catch {
                // Skip files that can't be read
            }
        }
    } catch {
        // Return empty if workspace scan fails
    }

    return prefabs;
}

/**
 * Parses a prefab definition from registerPrefab call
 */
function parsePrefabDefinition(
    lines: string[],
    startLine: number,
    filePath: string
): PrefabInfo | null {
    // Gather lines until we have the full registerPrefab call
    let fullText = '';
    let parenCount = 0;
    let started = false;

    for (let i = startLine; i < lines.length && i < startLine + 30; i++) {
        fullText += lines[i] + '\n';

        for (const char of lines[i]) {
            if (char === '(') {
                parenCount++;
                started = true;
            } else if (char === ')') {
                parenCount--;
            }
        }

        if (started && parenCount === 0) {
            break;
        }
    }

    // Extract prefab name
    const nameMatch = fullText.match(/\.registerPrefab\s*\(\s*['"`](\w+)['"`]/);
    if (!nameMatch) {
        return null;
    }

    const name = nameMatch[1];

    // Extract components from the prefab definition
    const components: string[] = [];
    const componentsMatch = fullText.match(/components\s*:\s*\[([^\]]*)\]/s);
    if (componentsMatch) {
        const typeMatches = componentsMatch[1].match(/type\s*:\s*(\w+)/g);
        if (typeMatches) {
            components.push(...typeMatches.map((t) => t.replace(/type\s*:\s*/, '')));
        }
    }

    // Extract tags
    const tags: string[] = [];
    const tagsMatch = fullText.match(/tags\s*:\s*\[([^\]]*)\]/);
    if (tagsMatch) {
        const tagStrings = tagsMatch[1].match(/['"`](\w+)['"`]/g);
        if (tagStrings) {
            tags.push(...tagStrings.map((t) => t.replace(/['"`]/g, '')));
        }
    }

    return {
        name,
        filePath,
        line: startLine + 1,
        components,
        tags,
    };
}

/**
 * Parses a prefab from EntityPrefab type annotation
 */
function parsePrefabObject(
    lines: string[],
    startLine: number,
    filePath: string
): PrefabInfo | null {
    // Get the variable name
    const varMatch = lines[startLine].match(/(?:const|let)\s+(\w+)\s*:\s*EntityPrefab/);
    if (!varMatch) {
        return null;
    }

    // Gather lines until we have the full object
    let fullText = '';
    let braceCount = 0;
    let started = false;

    for (let i = startLine; i < lines.length && i < startLine + 30; i++) {
        fullText += lines[i] + '\n';

        for (const char of lines[i]) {
            if (char === '{') {
                braceCount++;
                started = true;
            } else if (char === '}') {
                braceCount--;
            }
        }

        if (started && braceCount === 0) {
            break;
        }
    }

    // Extract name from object
    const nameMatch = fullText.match(/name\s*:\s*['"`](\w+)['"`]/);
    const name = nameMatch ? nameMatch[1] : varMatch[1];

    // Extract components
    const components: string[] = [];
    const componentsMatch = fullText.match(/components\s*:\s*\[([^\]]*)\]/s);
    if (componentsMatch) {
        const typeMatches = componentsMatch[1].match(/type\s*:\s*(\w+)/g);
        if (typeMatches) {
            components.push(...typeMatches.map((t) => t.replace(/type\s*:\s*/, '')));
        }
    }

    // Extract tags
    const tags: string[] = [];
    const tagsMatch = fullText.match(/tags\s*:\s*\[([^\]]*)\]/);
    if (tagsMatch) {
        const tagStrings = tagsMatch[1].match(/['"`](\w+)['"`]/g);
        if (tagStrings) {
            tags.push(...tagStrings.map((t) => t.replace(/['"`]/g, '')));
        }
    }

    return {
        name,
        filePath,
        line: startLine + 1,
        components,
        tags,
    };
}
