import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'missingDefault' | 'suggestDefault';

type Options = [
    {
        /** Regex pattern for component class names */
        componentPattern?: string;
        /** Allow parameters without defaults if they're optional (have ?) */
        allowOptionalWithoutDefault?: boolean;
    },
];

/**
 * Check if a class is likely a component
 */
function isComponentClass(
    node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
    componentPattern: RegExp
): boolean {
    if (node.id?.name && componentPattern.test(node.id.name)) {
        return true;
    }
    return false;
}

/**
 * Get constructor from class body
 */
function getConstructor(
    node: TSESTree.ClassDeclaration | TSESTree.ClassExpression
): TSESTree.MethodDefinition | null {
    for (const member of node.body.body) {
        if (member.type === 'MethodDefinition' && member.kind === 'constructor') {
            return member;
        }
    }
    return null;
}

/**
 * Check if a parameter has a default value
 */
function hasDefaultValue(param: TSESTree.Parameter): boolean {
    return param.type === 'AssignmentPattern';
}

/**
 * Check if a parameter is optional (has ? modifier)
 */
function isOptionalParameter(param: TSESTree.Parameter): boolean {
    if (param.type === 'Identifier') {
        return param.optional === true;
    }
    if (param.type === 'TSParameterProperty') {
        const innerParam = param.parameter;
        if (innerParam.type === 'Identifier') {
            return innerParam.optional === true;
        }
        if (innerParam.type === 'AssignmentPattern') {
            return true; // Has default, counts as optional
        }
    }
    return false;
}

/**
 * Get the parameter name
 */
function getParameterName(param: TSESTree.Parameter): string {
    if (param.type === 'Identifier') {
        return param.name;
    }
    if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
        return param.left.name;
    }
    if (param.type === 'TSParameterProperty') {
        const innerParam = param.parameter;
        if (innerParam.type === 'Identifier') {
            return innerParam.name;
        }
        if (innerParam.type === 'AssignmentPattern' && innerParam.left.type === 'Identifier') {
            return innerParam.left.name;
        }
    }
    return 'unknown';
}

/**
 * Check if parameter has default value (including TS parameter property)
 */
function parameterHasDefault(param: TSESTree.Parameter): boolean {
    if (hasDefaultValue(param)) {
        return true;
    }
    if (param.type === 'TSParameterProperty') {
        const innerParam = param.parameter;
        if (innerParam.type === 'AssignmentPattern') {
            return true;
        }
    }
    return false;
}

/**
 * Rule: component-default-params
 *
 * Ensures component constructors have default parameter values for easier instantiation.
 */
export const componentDefaultParams = createRule<Options, MessageIds>({
    name: 'component-default-params',
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Ensure component constructor parameters have default values for easier instantiation',
        },
        messages: {
            missingDefault:
                'Component "{{className}}" constructor parameter "{{paramName}}" should have a default value. This enables `entity.addComponent({{className}})` without arguments.',
            suggestDefault: 'Add a default value like `{{paramName}} = {{suggestedDefault}}`.',
        },
        hasSuggestions: true,
        schema: [
            {
                type: 'object',
                properties: {
                    componentPattern: {
                        type: 'string',
                        description: 'Regex pattern for component class names',
                    },
                    allowOptionalWithoutDefault: {
                        type: 'boolean',
                        description: 'Allow optional params (?) without defaults',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            componentPattern:
                '(Component|Position|Velocity|Health|Transform|Sprite|Collider|RigidBody|Renderable|Tag|State|Data)$',
            allowOptionalWithoutDefault: true,
        },
    ],
    create(context, [options]) {
        const componentPattern = new RegExp(
            options.componentPattern ??
                '(Component|Position|Velocity|Health|Transform|Sprite|Collider|RigidBody|Renderable|Tag|State|Data)$'
        );
        const allowOptionalWithoutDefault = options.allowOptionalWithoutDefault ?? true;

        function checkClass(node: TSESTree.ClassDeclaration | TSESTree.ClassExpression): void {
            if (!isComponentClass(node, componentPattern)) {
                return;
            }

            const constructor = getConstructor(node);
            if (!constructor) {
                return; // No constructor, nothing to check
            }

            const constructorValue = constructor.value;
            if (constructorValue.type !== 'FunctionExpression') {
                return;
            }

            const params = constructorValue.params;

            for (const param of params) {
                // Skip rest parameters
                if (param.type === 'RestElement') {
                    continue;
                }

                // Skip if has default
                if (parameterHasDefault(param)) {
                    continue;
                }

                // Skip optional params if allowed
                if (allowOptionalWithoutDefault && isOptionalParameter(param)) {
                    continue;
                }

                const paramName = getParameterName(param);
                const className = node.id?.name || 'Component';

                // Suggest a default based on common patterns
                let suggestedDefault = '0';
                const lowerName = paramName.toLowerCase();
                if (
                    lowerName.includes('string') ||
                    lowerName.includes('name') ||
                    lowerName.includes('text')
                ) {
                    suggestedDefault = "''";
                } else if (
                    lowerName.includes('bool') ||
                    lowerName.includes('enabled') ||
                    lowerName.includes('active')
                ) {
                    suggestedDefault = 'false';
                } else if (
                    lowerName.includes('array') ||
                    lowerName.includes('list') ||
                    lowerName.includes('items')
                ) {
                    suggestedDefault = '[]';
                } else if (
                    lowerName.includes('object') ||
                    lowerName.includes('config') ||
                    lowerName.includes('options')
                ) {
                    suggestedDefault = '{}';
                }

                context.report({
                    node: param,
                    messageId: 'missingDefault',
                    data: {
                        className,
                        paramName,
                    },
                    suggest: [
                        {
                            desc: `Add default value: ${paramName} = ${suggestedDefault}`,
                            fix: (fixer) => {
                                // Get the text of the parameter
                                const sourceCode = context.sourceCode;
                                const paramText = sourceCode.getText(param);

                                // Insert default value
                                if (param.type === 'TSParameterProperty') {
                                    // For TypeScript parameter properties: public x: number -> public x: number = 0
                                    return fixer.insertTextAfter(param, ` = ${suggestedDefault}`);
                                } else if (param.type === 'Identifier') {
                                    // For regular parameters: x -> x = 0
                                    const typeAnnotation = param.typeAnnotation;
                                    if (typeAnnotation) {
                                        return fixer.insertTextAfter(
                                            param,
                                            ` = ${suggestedDefault}`
                                        );
                                    } else {
                                        return fixer.replaceText(
                                            param,
                                            `${paramText} = ${suggestedDefault}`
                                        );
                                    }
                                }
                                return null;
                            },
                        },
                    ],
                });
            }
        }

        return {
            ClassDeclaration: checkClass,
            ClassExpression: checkClass,
        };
    },
});

export default componentDefaultParams;
