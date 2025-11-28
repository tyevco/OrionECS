import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { ComponentCodeLensProvider } from './providers/ComponentCodeLensProvider';
import { ComponentRenameProvider } from './providers/ComponentRenameProvider';
import { ECSCompletionProvider } from './providers/ECSCompletionProvider';
import { ECSDefinitionProvider } from './providers/ECSDefinitionProvider';
import { ECSHoverProvider } from './providers/ECSHoverProvider';
import { ECSReferenceProvider } from './providers/ECSReferenceProvider';
import {
    ExtractComponentCodeActionProvider,
    registerExtractComponentCommand,
} from './providers/ExtractComponentCodeActionProvider';
import { ComponentsTreeProvider } from './views/ComponentsTreeProvider';
import { EntitiesTreeProvider } from './views/EntitiesTreeProvider';
import { EntityHierarchyTreeProvider } from './views/EntityHierarchyTreeProvider';
import { SystemsTreeProvider } from './views/SystemsTreeProvider';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('OrionECS');
    outputChannel.appendLine('OrionECS extension activated');

    // Register tree view providers
    const componentsProvider = new ComponentsTreeProvider();
    const systemsProvider = new SystemsTreeProvider();
    const entitiesProvider = new EntitiesTreeProvider();
    const entityHierarchyProvider = new EntityHierarchyTreeProvider(outputChannel);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('orion-ecs.componentsView', componentsProvider),
        vscode.window.registerTreeDataProvider('orion-ecs.systemsView', systemsProvider),
        vscode.window.registerTreeDataProvider('orion-ecs.entitiesView', entitiesProvider),
        vscode.window.registerTreeDataProvider(
            'orion-ecs.entityHierarchyView',
            entityHierarchyProvider
        )
    );

    // Initialize the hierarchy provider (connects to debug bridge when available)
    entityHierarchyProvider.initialize();

    // Register CodeLens provider for component usage
    const codeLensProvider = new ComponentCodeLensProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            [
                { language: 'typescript', scheme: 'file' },
                { language: 'javascript', scheme: 'file' },
            ],
            codeLensProvider
        )
    );

    // Register completion provider for ECS-specific completions
    const completionProvider = new ECSCompletionProvider();
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            [
                { language: 'typescript', scheme: 'file' },
                { language: 'javascript', scheme: 'file' },
            ],
            completionProvider,
            '.',
            ':',
            '['
        )
    );

    // Register hover provider for ECS documentation
    const hoverProvider = new ECSHoverProvider();
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            [
                { language: 'typescript', scheme: 'file' },
                { language: 'javascript', scheme: 'file' },
            ],
            hoverProvider
        )
    );

    // Register definition provider for Go to Definition
    const definitionProvider = new ECSDefinitionProvider();
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            [
                { language: 'typescript', scheme: 'file' },
                { language: 'javascript', scheme: 'file' },
            ],
            definitionProvider
        )
    );

    // Register reference provider for Find All References
    const referenceProvider = new ECSReferenceProvider();
    context.subscriptions.push(
        vscode.languages.registerReferenceProvider(
            [
                { language: 'typescript', scheme: 'file' },
                { language: 'javascript', scheme: 'file' },
            ],
            referenceProvider
        )
    );

    // Register rename provider for component refactoring
    const renameProvider = new ComponentRenameProvider();
    context.subscriptions.push(
        vscode.languages.registerRenameProvider(
            [
                { language: 'typescript', scheme: 'file' },
                { language: 'javascript', scheme: 'file' },
            ],
            renameProvider
        )
    );

    // Register code action provider for extract component refactoring
    const extractProvider = new ExtractComponentCodeActionProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            [
                { language: 'typescript', scheme: 'file' },
                { language: 'javascript', scheme: 'file' },
            ],
            extractProvider,
            {
                providedCodeActionKinds: ExtractComponentCodeActionProvider.providedCodeActionKinds,
            }
        )
    );

    // Register extract component command
    registerExtractComponentCommand(context, outputChannel);

    // Register commands
    registerCommands(context, {
        componentsProvider,
        systemsProvider,
        entitiesProvider,
        entityHierarchyProvider,
        referenceProvider,
        outputChannel,
        extensionUri: context.extensionUri,
    });

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('orion-ecs')) {
                outputChannel.appendLine('OrionECS configuration changed');
                // Refresh providers when configuration changes
                componentsProvider.refresh();
                systemsProvider.refresh();
                entitiesProvider.refresh();
            }
        })
    );

    // Watch for file changes to update tree views
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,js}');
    context.subscriptions.push(
        fileWatcher.onDidChange(() => {
            componentsProvider.refresh();
            systemsProvider.refresh();
        }),
        fileWatcher.onDidCreate(() => {
            componentsProvider.refresh();
            systemsProvider.refresh();
        }),
        fileWatcher.onDidDelete(() => {
            componentsProvider.refresh();
            systemsProvider.refresh();
        }),
        fileWatcher
    );

    outputChannel.appendLine('OrionECS extension setup complete');

    return {
        getOutputChannel: () => outputChannel,
    };
}

export function deactivate() {
    if (outputChannel) {
        outputChannel.appendLine('OrionECS extension deactivated');
        outputChannel.dispose();
    }
}
