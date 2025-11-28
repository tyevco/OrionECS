import type { ParserServicesWithTypeInformation } from '@typescript-eslint/utils';
import * as ts from 'typescript';

/**
 * Metadata about a component gathered from registerComponentValidator calls
 */
export interface ComponentMetadata {
    dependencies: Set<string>;
    conflicts: Set<string>;
}

/**
 * Registry of component metadata gathered from cross-file scanning
 */
export interface ComponentRegistry {
    components: Map<string, ComponentMetadata>;
    /** All known component names (from validators, prefabs, systems) */
    knownComponents: Set<string>;
}

// Cache for component registry - persists across files in a single lint run
let cachedRegistry: ComponentRegistry | null = null;
let cachedProgramId: number | null = null;
let programIdCounter = 0;

// WeakMap to track program instances
const programIds = new WeakMap<ts.Program, number>();

function getProgramId(program: ts.Program): number {
    let id = programIds.get(program);
    if (id === undefined) {
        id = programIdCounter++;
        programIds.set(program, id);
    }
    return id;
}

/**
 * Get or build the component registry by scanning all TypeScript files in the program.
 * Results are cached per program instance.
 */
export function getComponentRegistry(
    parserServices: ParserServicesWithTypeInformation
): ComponentRegistry {
    const program = parserServices.program;
    const programId = getProgramId(program);

    // Return cached registry if program hasn't changed
    if (cachedRegistry && cachedProgramId === programId) {
        return cachedRegistry;
    }

    // Build new registry
    const registry: ComponentRegistry = {
        components: new Map(),
        knownComponents: new Set(),
    };

    // Scan all source files in the program
    for (const sourceFile of program.getSourceFiles()) {
        // Skip declaration files and node_modules
        if (sourceFile.isDeclarationFile) continue;
        if (sourceFile.fileName.includes('node_modules')) continue;

        scanSourceFile(sourceFile, registry);
    }

    // Cache the registry
    cachedRegistry = registry;
    cachedProgramId = programId;

    return registry;
}

/**
 * Clear the cached registry (useful for testing)
 */
export function clearComponentRegistry(): void {
    cachedRegistry = null;
    cachedProgramId = null;
}

/**
 * Scan a TypeScript source file for component-related calls
 */
function scanSourceFile(sourceFile: ts.SourceFile, registry: ComponentRegistry): void {
    function visit(node: ts.Node): void {
        if (ts.isCallExpression(node)) {
            processCallExpression(node, registry);
        }
        ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
}

/**
 * Process a call expression to extract component metadata
 */
function processCallExpression(node: ts.CallExpression, registry: ComponentRegistry): void {
    // Check for registerComponentValidator calls
    if (isRegisterComponentValidatorCall(node)) {
        processRegisterComponentValidator(node, registry);
        return;
    }

    // Check for registerPrefab calls to gather known components
    if (isRegisterPrefabCall(node)) {
        processRegisterPrefab(node, registry);
        return;
    }

    // Check for createSystem calls to gather known components
    if (isCreateSystemCall(node)) {
        processCreateSystem(node, registry);
        return;
    }
}

/**
 * Check if a call is to registerComponentValidator
 */
function isRegisterComponentValidatorCall(node: ts.CallExpression): boolean {
    const expr = node.expression;

    // engine.registerComponentValidator(...)
    if (ts.isPropertyAccessExpression(expr)) {
        return expr.name.text === 'registerComponentValidator';
    }

    // registerComponentValidator(...) - direct call
    if (ts.isIdentifier(expr)) {
        return expr.text === 'registerComponentValidator';
    }

    return false;
}

/**
 * Check if a call is to registerPrefab
 */
function isRegisterPrefabCall(node: ts.CallExpression): boolean {
    const expr = node.expression;

    if (ts.isPropertyAccessExpression(expr)) {
        return expr.name.text === 'registerPrefab';
    }

    if (ts.isIdentifier(expr)) {
        return expr.text === 'registerPrefab';
    }

    return false;
}

/**
 * Check if a call is to createSystem
 */
function isCreateSystemCall(node: ts.CallExpression): boolean {
    const expr = node.expression;

    if (ts.isPropertyAccessExpression(expr)) {
        return expr.name.text === 'createSystem';
    }

    return false;
}

/**
 * Process a registerComponentValidator call to extract metadata
 */
function processRegisterComponentValidator(
    node: ts.CallExpression,
    registry: ComponentRegistry
): void {
    // registerComponentValidator(ComponentClass, options)
    if (node.arguments.length < 2) return;

    const componentArg = node.arguments[0];
    const optionsArg = node.arguments[1];

    // Get component name
    const componentName = getIdentifierName(componentArg);
    if (!componentName) return;

    registry.knownComponents.add(componentName);

    // Get or create metadata for this component
    let metadata = registry.components.get(componentName);
    if (!metadata) {
        metadata = { dependencies: new Set(), conflicts: new Set() };
        registry.components.set(componentName, metadata);
    }

    // Parse options object
    if (!ts.isObjectLiteralExpression(optionsArg)) return;

    for (const prop of optionsArg.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        if (!ts.isIdentifier(prop.name)) continue;

        const propName = prop.name.text;

        if (propName === 'dependencies') {
            const deps = extractArrayElements(prop.initializer);
            for (const dep of deps) {
                metadata.dependencies.add(dep);
                registry.knownComponents.add(dep);
            }
        } else if (propName === 'conflicts') {
            const conflicts = extractArrayElements(prop.initializer);
            for (const conflict of conflicts) {
                metadata.conflicts.add(conflict);
                registry.knownComponents.add(conflict);
            }
        }
    }
}

/**
 * Process a registerPrefab call to gather known components
 */
function processRegisterPrefab(node: ts.CallExpression, registry: ComponentRegistry): void {
    // registerPrefab(name, prefabDef) - prefabDef.components
    if (node.arguments.length < 2) return;

    const prefabDef = node.arguments[1];
    if (!ts.isObjectLiteralExpression(prefabDef)) return;

    for (const prop of prefabDef.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        if (!ts.isIdentifier(prop.name)) continue;

        if (prop.name.text === 'components') {
            if (ts.isArrayLiteralExpression(prop.initializer)) {
                for (const element of prop.initializer.elements) {
                    const componentName = extractComponentFromPrefabEntry(element);
                    if (componentName) {
                        registry.knownComponents.add(componentName);
                    }
                }
            }
        }
    }
}

/**
 * Process a createSystem call to gather known components
 */
function processCreateSystem(node: ts.CallExpression, registry: ComponentRegistry): void {
    // createSystem(name, query, options)
    if (node.arguments.length < 2) return;

    const queryArg = node.arguments[1];
    if (!ts.isObjectLiteralExpression(queryArg)) return;

    for (const prop of queryArg.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        if (!ts.isIdentifier(prop.name)) continue;

        const propName = prop.name.text;
        if (propName === 'all' || propName === 'none' || propName === 'any') {
            const components = extractArrayElements(prop.initializer);
            for (const component of components) {
                registry.knownComponents.add(component);
            }
        }
    }
}

/**
 * Extract component name from a prefab component entry
 * Handles: { type: ComponentClass, args: [...] } or just ComponentClass
 */
function extractComponentFromPrefabEntry(node: ts.Node): string | null {
    // Direct identifier: ComponentClass
    if (ts.isIdentifier(node)) {
        return node.text;
    }

    // Object with type property: { type: ComponentClass, ... }
    if (ts.isObjectLiteralExpression(node)) {
        for (const prop of node.properties) {
            if (!ts.isPropertyAssignment(prop)) continue;
            if (!ts.isIdentifier(prop.name)) continue;

            if (prop.name.text === 'type') {
                return getIdentifierName(prop.initializer);
            }
        }
    }

    return null;
}

/**
 * Get the name from an identifier node
 */
function getIdentifierName(node: ts.Node): string | null {
    if (ts.isIdentifier(node)) {
        return node.text;
    }
    return null;
}

/**
 * Extract string or identifier names from an array literal
 */
function extractArrayElements(node: ts.Node): string[] {
    if (!ts.isArrayLiteralExpression(node)) return [];

    const elements: string[] = [];
    for (const element of node.elements) {
        if (ts.isIdentifier(element)) {
            elements.push(element.text);
        } else if (ts.isStringLiteral(element)) {
            elements.push(element.text);
        }
    }
    return elements;
}

/**
 * Check if parser services have type information available
 */
export function hasTypeInformation(
    parserServices: unknown
): parserServices is ParserServicesWithTypeInformation {
    return (
        parserServices != null &&
        typeof parserServices === 'object' &&
        'program' in parserServices &&
        parserServices.program != null
    );
}
