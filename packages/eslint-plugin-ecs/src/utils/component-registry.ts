import type { ParserServicesWithTypeInformation } from '@typescript-eslint/utils';
import * as ts from 'typescript';

/**
 * Metadata about a component gathered from registerComponentValidator calls
 */
export interface ComponentMetadata {
    dependencies: Set<string>;
    conflicts: Set<string>;
    /** The fully qualified type name (e.g., "Position" from "@orion-ecs/core") */
    qualifiedName?: string;
    /** The source file where this component's validator was defined */
    sourceFile?: string;
}

/**
 * Information about a resolved type
 */
export interface ResolvedTypeInfo {
    /** The simple name of the type */
    name: string;
    /** The fully qualified name including module path */
    qualifiedName: string;
    /** Whether this is a class type */
    isClass: boolean;
    /** The source file where the type is declared */
    declarationFile?: string;
    /** Whether this type comes from node_modules */
    isExternal: boolean;
}

/**
 * Registry of component metadata gathered from cross-file scanning
 */
export interface ComponentRegistry {
    components: Map<string, ComponentMetadata>;
    /** All known component names (from validators, prefabs, systems) */
    knownComponents: Set<string>;
    /** Map from qualified type name to simple name for resolving imports */
    typeAliases: Map<string, string>;
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

    const checker = program.getTypeChecker();

    // Build new registry
    const registry: ComponentRegistry = {
        components: new Map(),
        knownComponents: new Set(),
        typeAliases: new Map(),
    };

    // Scan all source files in the program
    for (const sourceFile of program.getSourceFiles()) {
        // Skip declaration files and node_modules
        if (sourceFile.isDeclarationFile) continue;
        if (sourceFile.fileName.includes('node_modules')) continue;

        scanSourceFile(sourceFile, registry, checker);
    }

    // Cache the registry
    cachedRegistry = registry;
    cachedProgramId = programId;

    return registry;
}

/**
 * Resolve a TypeScript node to its actual type information.
 * This follows imports, type aliases, and resolves types from external packages.
 */
export function resolveTypeInfo(node: ts.Node, checker: ts.TypeChecker): ResolvedTypeInfo | null {
    try {
        const type = checker.getTypeAtLocation(node);
        const symbol = type.getSymbol() ?? type.aliasSymbol;

        if (!symbol) {
            // For identifiers, try to get the symbol directly
            if (ts.isIdentifier(node)) {
                const identifierSymbol = checker.getSymbolAtLocation(node);
                if (identifierSymbol) {
                    return resolveSymbolInfo(identifierSymbol, checker, node);
                }
            }
            return null;
        }

        return resolveSymbolInfo(symbol, checker, node);
    } catch {
        // Type resolution can fail for various reasons, return null gracefully
        return null;
    }
}

/**
 * Resolve symbol information to ResolvedTypeInfo
 */
function resolveSymbolInfo(
    symbol: ts.Symbol,
    _checker: ts.TypeChecker,
    _node: ts.Node
): ResolvedTypeInfo | null {
    const name = symbol.getName();
    const declarations = symbol.getDeclarations();

    if (!declarations || declarations.length === 0) {
        return {
            name,
            qualifiedName: name,
            isClass: false,
            isExternal: false,
        };
    }

    const declaration = declarations[0];
    const sourceFile = declaration.getSourceFile();
    const fileName = sourceFile.fileName;
    const isExternal = fileName.includes('node_modules');

    // Check if it's a class
    const isClass = declarations.some((d) => ts.isClassDeclaration(d) || ts.isClassExpression(d));

    // Build qualified name using the module specifier if available
    let qualifiedName = name;

    // Try to get the module name for external types
    if (isExternal) {
        const modulePath = getModuleName(fileName);
        if (modulePath) {
            qualifiedName = `${modulePath}:${name}`;
        }
    } else {
        // For local types, use the relative file path
        qualifiedName = `${fileName}:${name}`;
    }

    return {
        name,
        qualifiedName,
        isClass,
        declarationFile: fileName,
        isExternal,
    };
}

/**
 * Extract module name from a file path in node_modules
 */
function getModuleName(fileName: string): string | null {
    const nodeModulesIndex = fileName.lastIndexOf('node_modules');
    if (nodeModulesIndex === -1) return null;

    const afterNodeModules = fileName.slice(nodeModulesIndex + 'node_modules/'.length);

    // Handle scoped packages (@org/package)
    if (afterNodeModules.startsWith('@')) {
        const parts = afterNodeModules.split('/');
        if (parts.length >= 2) {
            return `${parts[0]}/${parts[1]}`;
        }
    }

    // Regular package
    const firstSlash = afterNodeModules.indexOf('/');
    if (firstSlash !== -1) {
        return afterNodeModules.slice(0, firstSlash);
    }

    return afterNodeModules;
}

/**
 * Get the type checker from parser services
 */
export function getTypeChecker(parserServices: ParserServicesWithTypeInformation): ts.TypeChecker {
    return parserServices.program.getTypeChecker();
}

/**
 * Resolve a component argument to its actual type name.
 * This handles imports, type aliases, and external packages.
 */
export function resolveComponentType(node: ts.Node, checker: ts.TypeChecker): string | null {
    const typeInfo = resolveTypeInfo(node, checker);
    if (!typeInfo) return null;

    // For classes, return the simple name (which is what we use for matching)
    // The qualified name is stored for more precise matching if needed
    return typeInfo.name;
}

/**
 * Check if a type is a valid component class (a class type, not an interface or type alias)
 */
export function isValidComponentClass(node: ts.Node, checker: ts.TypeChecker): boolean {
    const typeInfo = resolveTypeInfo(node, checker);
    return typeInfo?.isClass ?? false;
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
function scanSourceFile(
    sourceFile: ts.SourceFile,
    registry: ComponentRegistry,
    checker: ts.TypeChecker
): void {
    function visit(node: ts.Node): void {
        if (ts.isCallExpression(node)) {
            processCallExpression(node, registry, checker);
        }
        ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
}

/**
 * Process a call expression to extract component metadata
 */
function processCallExpression(
    node: ts.CallExpression,
    registry: ComponentRegistry,
    checker: ts.TypeChecker
): void {
    // Check for registerComponentValidator calls
    if (isRegisterComponentValidatorCall(node)) {
        processRegisterComponentValidator(node, registry, checker);
        return;
    }

    // Check for registerPrefab calls to gather known components
    if (isRegisterPrefabCall(node)) {
        processRegisterPrefab(node, registry, checker);
        return;
    }

    // Check for createSystem calls to gather known components
    if (isCreateSystemCall(node)) {
        processCreateSystem(node, registry, checker);
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
    registry: ComponentRegistry,
    checker: ts.TypeChecker
): void {
    // registerComponentValidator(ComponentClass, options)
    if (node.arguments.length < 2) return;

    const componentArg = node.arguments[0];
    const optionsArg = node.arguments[1];

    // Get component name using type checker for proper resolution
    const componentName =
        resolveComponentType(componentArg, checker) ?? getIdentifierName(componentArg);
    if (!componentName) return;

    registry.knownComponents.add(componentName);

    // Get type info for qualified name
    const typeInfo = resolveTypeInfo(componentArg, checker);

    // Get or create metadata for this component
    let metadata = registry.components.get(componentName);
    if (!metadata) {
        metadata = { dependencies: new Set(), conflicts: new Set() };
        registry.components.set(componentName, metadata);
    }

    // Store qualified name and source file
    if (typeInfo) {
        metadata.qualifiedName = typeInfo.qualifiedName;
        metadata.sourceFile = typeInfo.declarationFile;

        // Also add type alias mapping for cross-file resolution
        registry.typeAliases.set(typeInfo.qualifiedName, componentName);
    }

    // Parse options object
    if (!ts.isObjectLiteralExpression(optionsArg)) return;

    for (const prop of optionsArg.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        if (!ts.isIdentifier(prop.name)) continue;

        const propName = prop.name.text;

        if (propName === 'dependencies') {
            const deps = extractArrayElementsWithTypeChecker(prop.initializer, checker);
            for (const dep of deps) {
                metadata.dependencies.add(dep);
                registry.knownComponents.add(dep);
            }
        } else if (propName === 'conflicts') {
            const conflicts = extractArrayElementsWithTypeChecker(prop.initializer, checker);
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
function processRegisterPrefab(
    node: ts.CallExpression,
    registry: ComponentRegistry,
    checker: ts.TypeChecker
): void {
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
                    const componentName = extractComponentFromPrefabEntry(element, checker);
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
function processCreateSystem(
    node: ts.CallExpression,
    registry: ComponentRegistry,
    checker: ts.TypeChecker
): void {
    // createSystem(name, query, options)
    if (node.arguments.length < 2) return;

    const queryArg = node.arguments[1];
    if (!ts.isObjectLiteralExpression(queryArg)) return;

    for (const prop of queryArg.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        if (!ts.isIdentifier(prop.name)) continue;

        const propName = prop.name.text;
        if (propName === 'all' || propName === 'none' || propName === 'any') {
            const components = extractArrayElementsWithTypeChecker(prop.initializer, checker);
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
function extractComponentFromPrefabEntry(node: ts.Node, checker: ts.TypeChecker): string | null {
    // Direct identifier: ComponentClass - resolve the actual type
    if (ts.isIdentifier(node)) {
        return resolveComponentType(node, checker) ?? node.text;
    }

    // Object with type property: { type: ComponentClass, ... }
    if (ts.isObjectLiteralExpression(node)) {
        for (const prop of node.properties) {
            if (!ts.isPropertyAssignment(prop)) continue;
            if (!ts.isIdentifier(prop.name)) continue;

            if (prop.name.text === 'type') {
                // Resolve the type property value
                return (
                    resolveComponentType(prop.initializer, checker) ??
                    getIdentifierName(prop.initializer)
                );
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
 * Extract component names from an array literal using the type checker.
 * This resolves imported types to their actual names, including types from external packages.
 */
function extractArrayElementsWithTypeChecker(node: ts.Node, checker: ts.TypeChecker): string[] {
    if (!ts.isArrayLiteralExpression(node)) return [];

    const elements: string[] = [];
    for (const element of node.elements) {
        // Try to resolve the type first (handles imports, aliases, etc.)
        const resolved = resolveComponentType(element, checker);
        if (resolved) {
            elements.push(resolved);
            continue;
        }

        // Fall back to simple extraction
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
        parserServices !== null &&
        parserServices !== undefined &&
        typeof parserServices === 'object' &&
        'program' in parserServices &&
        parserServices.program !== null &&
        parserServices.program !== undefined
    );
}
