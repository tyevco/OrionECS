import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds =
    | 'missingNameField'
    | 'missingVersionField'
    | 'invalidVersionFormat'
    | 'missingInstallMethod'
    | 'pluginNamingConvention'
    | 'nameFieldMismatch';

type Options = [
    {
        /** Require plugin class names to end with 'Plugin' */
        requirePluginSuffix?: boolean;
        /** Require version to be valid semver */
        requireSemver?: boolean;
    },
];

/**
 * Check if version string is valid semver
 */
function isValidSemver(version: string): boolean {
    // Basic semver pattern: major.minor.patch with optional prerelease
    const semverPattern = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
    return semverPattern.test(version);
}

/**
 * Check if a class implements EnginePlugin
 */
function isPluginClass(node: TSESTree.ClassDeclaration): boolean {
    if (!node.implements) return false;

    for (const impl of node.implements) {
        if (impl.expression.type === 'Identifier') {
            if (impl.expression.name === 'EnginePlugin') {
                return true;
            }
        }
    }

    return false;
}

/**
 * Find a property in a class
 */
function findClassProperty(
    node: TSESTree.ClassDeclaration,
    name: string
): TSESTree.PropertyDefinition | null {
    for (const member of node.body.body) {
        if (
            member.type === 'PropertyDefinition' &&
            member.key.type === 'Identifier' &&
            member.key.name === name
        ) {
            return member;
        }
    }
    return null;
}

/**
 * Find a method in a class
 */
function findClassMethod(
    node: TSESTree.ClassDeclaration,
    name: string
): TSESTree.MethodDefinition | null {
    for (const member of node.body.body) {
        if (
            member.type === 'MethodDefinition' &&
            member.key.type === 'Identifier' &&
            member.key.name === name
        ) {
            return member;
        }
    }
    return null;
}

/**
 * Get string value from a property
 */
function getStringValue(prop: TSESTree.PropertyDefinition): string | null {
    if (prop.value?.type === 'Literal' && typeof prop.value.value === 'string') {
        return prop.value.value;
    }
    return null;
}

/**
 * Rule: plugin-structure-validation
 *
 * Validates that plugin classes follow the required structure:
 * - Have a readonly name field
 * - Have a readonly version field (optionally semver)
 * - Have an install(context) method
 * - Follow naming conventions (end with 'Plugin')
 */
export const pluginStructureValidation = createRule<Options, MessageIds>({
    name: 'plugin-structure-validation',
    meta: {
        type: 'problem',
        docs: {
            description: 'Validate plugin class structure and required members',
        },
        messages: {
            missingNameField: 'Plugin class "{{className}}" is missing a readonly "name" field.',
            missingVersionField:
                'Plugin class "{{className}}" is missing a readonly "version" field.',
            invalidVersionFormat:
                'Plugin version "{{version}}" is not valid semver format (e.g., "1.0.0").',
            missingInstallMethod:
                'Plugin class "{{className}}" is missing the required "install(context)" method.',
            pluginNamingConvention: 'Plugin class "{{className}}" should end with "Plugin" suffix.',
            nameFieldMismatch:
                'Plugin name field "{{nameValue}}" does not match class name "{{className}}".',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    requirePluginSuffix: {
                        type: 'boolean',
                        description: 'Require plugin class names to end with Plugin',
                    },
                    requireSemver: {
                        type: 'boolean',
                        description: 'Require version to be valid semver',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            requirePluginSuffix: true,
            requireSemver: true,
        },
    ],
    create(context, [options]) {
        return {
            ClassDeclaration(node) {
                if (!isPluginClass(node)) return;
                if (!node.id) return;

                const className = node.id.name;

                // Check naming convention
                if (options.requirePluginSuffix && !className.endsWith('Plugin')) {
                    context.report({
                        node: node.id,
                        messageId: 'pluginNamingConvention',
                        data: { className },
                    });
                }

                // Check for name field
                const nameProp = findClassProperty(node, 'name');
                if (!nameProp) {
                    context.report({
                        node,
                        messageId: 'missingNameField',
                        data: { className },
                    });
                } else {
                    // Check name matches class name
                    const nameValue = getStringValue(nameProp);
                    if (nameValue && nameValue !== className) {
                        context.report({
                            node: nameProp,
                            messageId: 'nameFieldMismatch',
                            data: { nameValue, className },
                        });
                    }
                }

                // Check for version field
                const versionProp = findClassProperty(node, 'version');
                if (!versionProp) {
                    context.report({
                        node,
                        messageId: 'missingVersionField',
                        data: { className },
                    });
                } else if (options.requireSemver) {
                    const versionValue = getStringValue(versionProp);
                    if (versionValue && !isValidSemver(versionValue)) {
                        context.report({
                            node: versionProp,
                            messageId: 'invalidVersionFormat',
                            data: { version: versionValue },
                        });
                    }
                }

                // Check for install method
                const installMethod = findClassMethod(node, 'install');
                if (!installMethod) {
                    context.report({
                        node,
                        messageId: 'missingInstallMethod',
                        data: { className },
                    });
                }
            },
        };
    },
});

export default pluginStructureValidation;
