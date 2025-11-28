import {
    ESLintUtils,
    type ParserServicesWithTypeInformation,
    type TSESTree,
} from '@typescript-eslint/utils';
import * as ts from 'typescript';
import { hasTypeInformation } from '../utils/component-registry';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds =
    | 'componentHasMethods'
    | 'componentHasGettersSetters'
    | 'componentNotClass'
    | 'componentHasComplexLogic';

type Options = [
    {
        /**
         * Methods allowed in component classes (e.g., 'clone', 'reset')
         */
        allowedMethods?: string[];
        /**
         * Whether to check for getters/setters
         */
        checkGettersSetters?: boolean;
        /**
         * Whether to check external/library components
         */
        checkExternalTypes?: boolean;
        /**
         * Patterns to exclude from checking (regex strings)
         */
        excludePatterns?: string[];
    },
];

/**
 * Information about a method found in a component class
 */
interface MethodInfo {
    name: string;
    kind: 'method' | 'getter' | 'setter';
}

/**
 * Rule: component-types
 *
 * Validates that types passed to addComponent(), getComponent(), etc. are
 * data-only classes. Uses TypeScript's type checker to resolve and inspect
 * types, including those from external libraries.
 *
 * This catches cases where non-component classes are accidentally used as
 * components, which would violate ECS best practices.
 */
export const componentTypes = createRule<Options, MessageIds>({
    name: 'component-types',
    meta: {
        type: 'problem',
        docs: {
            description: 'Validate that component types used in ECS APIs are data-only classes',
            requiresTypeChecking: true,
        },
        messages: {
            componentHasMethods:
                'Component "{{typeName}}" has methods that should be in a System: {{methods}}. Components should be data-only.',
            componentHasGettersSetters:
                'Component "{{typeName}}" has getters/setters: {{accessors}}. Use plain properties instead.',
            componentNotClass:
                'Type "{{typeName}}" is not a class. Components must be class types with a constructor.',
            componentHasComplexLogic:
                'Component "{{typeName}}" appears to have complex logic. Components should be simple data containers.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    allowedMethods: {
                        type: 'array',
                        items: { type: 'string' },
                        description:
                            'Method names that are allowed in components (e.g., "clone", "reset")',
                    },
                    checkGettersSetters: {
                        type: 'boolean',
                        description: 'Whether to check for getters/setters (default: true)',
                    },
                    checkExternalTypes: {
                        type: 'boolean',
                        description: 'Whether to check types from node_modules (default: true)',
                    },
                    excludePatterns: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Regex patterns for type names to exclude from checking',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            allowedMethods: ['clone', 'reset', 'toString', 'toJSON', 'valueOf'],
            checkGettersSetters: true,
            checkExternalTypes: true,
            excludePatterns: [],
        },
    ],
    create(context, [options]) {
        const allowedMethods = new Set(options.allowedMethods ?? []);
        const checkGettersSetters = options.checkGettersSetters ?? true;
        const checkExternalTypes = options.checkExternalTypes ?? true;
        const excludePatterns = (options.excludePatterns ?? []).map((p) => new RegExp(p));

        // Check if type information is available
        const parserServices = context.sourceCode.parserServices;
        if (!hasTypeInformation(parserServices)) {
            // Can't do type checking without type information
            return {};
        }

        const typedServices = parserServices as ParserServicesWithTypeInformation;
        const checker = typedServices.program.getTypeChecker();

        /**
         * Check if a type name should be excluded from checking
         */
        function isExcluded(typeName: string): boolean {
            return excludePatterns.some((pattern) => pattern.test(typeName));
        }

        /**
         * Check if a file path is in node_modules
         */
        function isExternalFile(fileName: string): boolean {
            return fileName.includes('node_modules');
        }

        /**
         * Get methods and accessors from a class type that violate data-only rule
         */
        function getViolatingMembers(type: ts.Type): {
            methods: MethodInfo[];
            accessors: MethodInfo[];
        } {
            const methods: MethodInfo[] = [];
            const accessors: MethodInfo[] = [];

            const symbol = type.getSymbol();
            if (!symbol) {
                return { methods, accessors };
            }

            // Get all members of the class
            const members = symbol.members;
            if (!members) {
                return { methods, accessors };
            }

            members.forEach((memberSymbol, memberName) => {
                const name = memberName.toString();

                // Skip constructor
                if (name === '__constructor' || name === 'constructor') {
                    return;
                }

                // Skip allowed methods
                if (allowedMethods.has(name)) {
                    return;
                }

                // Skip private/internal members (convention: starts with _)
                if (name.startsWith('_')) {
                    return;
                }

                const declarations = memberSymbol.getDeclarations();
                if (!declarations || declarations.length === 0) {
                    return;
                }

                const declaration = declarations[0];

                // Check for methods
                if (ts.isMethodDeclaration(declaration)) {
                    methods.push({ name, kind: 'method' });
                    return;
                }

                // Check for getters/setters
                if (ts.isGetAccessorDeclaration(declaration)) {
                    accessors.push({ name, kind: 'getter' });
                    return;
                }

                if (ts.isSetAccessorDeclaration(declaration)) {
                    accessors.push({ name, kind: 'setter' });
                    return;
                }

                // Check for arrow function properties
                if (ts.isPropertyDeclaration(declaration)) {
                    const initializer = declaration.initializer;
                    if (
                        initializer &&
                        (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
                    ) {
                        methods.push({ name, kind: 'method' });
                    }
                }
            });

            return { methods, accessors };
        }

        /**
         * Check if a type is a class type
         */
        function isClassType(type: ts.Type): boolean {
            const symbol = type.getSymbol();
            if (!symbol) {
                return false;
            }

            const declarations = symbol.getDeclarations();
            if (!declarations || declarations.length === 0) {
                return false;
            }

            return declarations.some((d) => ts.isClassDeclaration(d) || ts.isClassExpression(d));
        }

        /**
         * Get the type name for error messages
         */
        function getTypeName(type: ts.Type): string {
            const symbol = type.getSymbol() ?? type.aliasSymbol;
            if (symbol) {
                return symbol.getName();
            }
            return checker.typeToString(type);
        }

        /**
         * Get the declaration file for a type
         */
        function getDeclarationFile(type: ts.Type): string | undefined {
            const symbol = type.getSymbol();
            if (!symbol) {
                return undefined;
            }

            const declarations = symbol.getDeclarations();
            if (!declarations || declarations.length === 0) {
                return undefined;
            }

            return declarations[0].getSourceFile().fileName;
        }

        /**
         * Check a component type argument
         */
        function checkComponentType(node: TSESTree.Node, callNode: TSESTree.CallExpression): void {
            try {
                const tsNode = typedServices.esTreeNodeToTSNodeMap.get(node);
                if (!tsNode) {
                    return;
                }

                // Get the type of the node
                const type = checker.getTypeAtLocation(tsNode);
                if (!type) {
                    return;
                }

                // For class references, we need to get the instance type
                // The type of `Position` (the class itself) is `typeof Position`
                // We need to get the construct signatures to find the instance type
                let instanceType = type;

                const constructSignatures = type.getConstructSignatures();
                if (constructSignatures.length > 0) {
                    // Get the return type of the construct signature (the instance type)
                    instanceType = constructSignatures[0].getReturnType();
                }

                const typeName = getTypeName(instanceType);

                // Check if excluded
                if (isExcluded(typeName)) {
                    return;
                }

                // Check if external and whether we should check external types
                const declarationFile = getDeclarationFile(instanceType);
                if (declarationFile && isExternalFile(declarationFile)) {
                    if (!checkExternalTypes) {
                        return;
                    }
                }

                // Check if it's a class type
                if (!isClassType(instanceType)) {
                    // Only report if we have a meaningful type name
                    if (typeName && typeName !== 'any' && typeName !== 'unknown') {
                        context.report({
                            node: callNode,
                            messageId: 'componentNotClass',
                            data: { typeName },
                        });
                    }
                    return;
                }

                // Check for violating members
                const { methods, accessors } = getViolatingMembers(instanceType);

                if (methods.length > 0) {
                    context.report({
                        node: callNode,
                        messageId: 'componentHasMethods',
                        data: {
                            typeName,
                            methods: methods.map((m) => m.name).join(', '),
                        },
                    });
                }

                if (checkGettersSetters && accessors.length > 0) {
                    context.report({
                        node: callNode,
                        messageId: 'componentHasGettersSetters',
                        data: {
                            typeName,
                            accessors: accessors.map((a) => a.name).join(', '),
                        },
                    });
                }
            } catch {
                // Type resolution can fail for various reasons, skip gracefully
            }
        }

        /**
         * Check if a call is a component API call and validate the type argument
         */
        function checkCallExpression(node: TSESTree.CallExpression): void {
            const callee = node.callee;

            // Must be a member expression (entity.addComponent, engine.createSystem, etc.)
            if (callee.type !== 'MemberExpression') {
                return;
            }

            if (callee.property.type !== 'Identifier') {
                return;
            }

            const methodName = callee.property.name;

            // Check single-component methods
            if (
                [
                    'addComponent',
                    'getComponent',
                    'hasComponent',
                    'removeComponent',
                    'registerComponent',
                    'registerComponentPool',
                    'registerComponentValidator',
                    'setSingleton',
                    'getSingleton',
                    'hasSingleton',
                    'removeSingleton',
                ].includes(methodName)
            ) {
                const componentArg = node.arguments[0];
                if (componentArg) {
                    checkComponentType(componentArg, node);
                }
                return;
            }

            // Check fluent query builder methods
            if (['withAll', 'withAny', 'withNone'].includes(methodName)) {
                for (const arg of node.arguments) {
                    checkComponentType(arg, node);
                }
                return;
            }

            // Check createSystem and createQuery with query objects
            if (methodName === 'createSystem' || methodName === 'createQuery') {
                const queryArg =
                    methodName === 'createSystem' ? node.arguments[1] : node.arguments[0];

                if (queryArg && queryArg.type === 'ObjectExpression') {
                    for (const prop of queryArg.properties) {
                        if (prop.type !== 'Property') continue;
                        if (prop.key.type !== 'Identifier') continue;

                        const keyName = prop.key.name;
                        if (['all', 'any', 'none', 'with', 'without'].includes(keyName)) {
                            if (prop.value.type === 'ArrayExpression') {
                                for (const element of prop.value.elements) {
                                    if (element) {
                                        checkComponentType(element, node);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return {
            CallExpression: checkCallExpression,
        };
    },
});

export default componentTypes;
