/**
 * Mock for the vscode module for unit testing
 */

export const Uri = {
    file: (path: string) => ({ fsPath: path, path, scheme: 'file' }),
    parse: (str: string) => ({ toString: () => str }),
};

export class Range {
    constructor(
        public startLine: number,
        public startChar: number,
        public endLine: number,
        public endChar: number
    ) {}
}

export class Position {
    constructor(
        public line: number,
        public character: number
    ) {}
}

export const TreeItemCollapsibleState = {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
};

export const TreeItem = class {
    label: string;
    collapsibleState: number;
    constructor(label: string, collapsibleState?: number) {
        this.label = label;
        this.collapsibleState = collapsibleState ?? 0;
    }
};

export const ThemeIcon = class {
    constructor(public id: string) {}
};

export const EventEmitter = class {
    private listeners: ((...args: unknown[]) => void)[] = [];
    event = (listener: (...args: unknown[]) => void) => {
        this.listeners.push(listener);
        return { dispose: () => {} };
    };
    fire = (data?: unknown) => {
        for (const listener of this.listeners) {
            listener(data);
        }
    };
};

export const CompletionItem = class {
    label: string;
    kind: number;
    constructor(label: string, kind?: number) {
        this.label = label;
        this.kind = kind ?? 0;
    }
};

export const CompletionItemKind = {
    Text: 0,
    Method: 1,
    Function: 2,
    Constructor: 3,
    Field: 4,
    Variable: 5,
    Class: 6,
    Interface: 7,
    Module: 8,
    Property: 9,
    Unit: 10,
    Value: 11,
    Enum: 12,
    Keyword: 13,
    Snippet: 14,
    Color: 15,
    File: 16,
    Reference: 17,
    Folder: 18,
    EnumMember: 19,
    Constant: 20,
    Struct: 21,
    Event: 22,
    Operator: 23,
    TypeParameter: 24,
};

export const Hover = class {
    contents: unknown;
    range?: Range;
    constructor(contents: unknown, range?: Range) {
        this.contents = contents;
        this.range = range;
    }
};

export const MarkdownString = class {
    value: string = '';
    appendMarkdown(text: string) {
        this.value += text;
        return this;
    }
    appendCodeblock(code: string, language?: string) {
        this.value += `\`\`\`${language || ''}\n${code}\n\`\`\`\n`;
        return this;
    }
};

export const CodeLens = class {
    range: Range;
    command: unknown;
    constructor(range: Range, command?: unknown) {
        this.range = range;
        this.command = command;
    }
};

export const SnippetString = class {
    value: string;
    constructor(value: string) {
        this.value = value;
    }
};

export const window = {
    createOutputChannel: () => ({
        appendLine: () => {},
        dispose: () => {},
    }),
    showInformationMessage: async () => undefined,
    showErrorMessage: async () => undefined,
    showWarningMessage: async () => undefined,
    showInputBox: async () => undefined,
    showQuickPick: async () => undefined,
    createWebviewPanel: () => ({
        webview: { html: '' },
        dispose: () => {},
    }),
    registerTreeDataProvider: () => ({ dispose: () => {} }),
    activeTextEditor: undefined,
};

export const workspace = {
    getConfiguration: () => ({
        get: (key: string, defaultValue?: unknown) => defaultValue,
    }),
    findFiles: async () => [],
    openTextDocument: async () => ({
        getText: () => '',
        lineAt: () => ({ text: '' }),
    }),
    createFileSystemWatcher: () => ({
        onDidChange: () => ({ dispose: () => {} }),
        onDidCreate: () => ({ dispose: () => {} }),
        onDidDelete: () => ({ dispose: () => {} }),
        dispose: () => {},
    }),
    onDidChangeConfiguration: () => ({ dispose: () => {} }),
    onDidChangeTextDocument: () => ({ dispose: () => {} }),
};

export const languages = {
    registerCodeLensProvider: () => ({ dispose: () => {} }),
    registerCompletionItemProvider: () => ({ dispose: () => {} }),
    registerHoverProvider: () => ({ dispose: () => {} }),
    registerRenameProvider: () => ({ dispose: () => {} }),
    registerCodeActionsProvider: () => ({ dispose: () => {} }),
};

export const WorkspaceEdit = class {
    private edits: Map<string, { range: Range; newText: string }[]> = new Map();

    replace(uri: { fsPath: string }, range: Range, newText: string) {
        const key = uri.fsPath;
        if (!this.edits.has(key)) {
            this.edits.set(key, []);
        }
        const editList = this.edits.get(key);
        if (editList) {
            editList.push({ range, newText });
        }
    }

    delete(uri: { fsPath: string }, range: Range) {
        this.replace(uri, range, '');
    }

    insert(uri: { fsPath: string }, position: Position, text: string) {
        const range = new Range(
            position.line,
            position.character,
            position.line,
            position.character
        );
        this.replace(uri, range, text);
    }

    createFile(
        _uri: { fsPath: string },
        _options?: { overwrite?: boolean; ignoreIfExists?: boolean }
    ) {
        // Mock implementation
    }

    getEdits() {
        return this.edits;
    }
};

export const CodeAction = class {
    title: string;
    kind?: { value: string };
    command?: unknown;

    constructor(title: string, kind?: { value: string }) {
        this.title = title;
        this.kind = kind;
    }
};

export const CodeActionKind = {
    RefactorExtract: { value: 'refactor.extract' },
    QuickFix: { value: 'quickfix' },
    Refactor: { value: 'refactor' },
};

export const ProgressLocation = {
    Notification: 15,
    SourceControl: 1,
    Window: 10,
};

export const CancellationTokenSource = class {
    token = { isCancellationRequested: false };
    cancel() {
        this.token.isCancellationRequested = true;
    }
    dispose() {}
};

export const commands = {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: async () => undefined,
};

export const env = {
    openExternal: async () => true,
};

export default {
    Uri,
    Range,
    Position,
    TreeItemCollapsibleState,
    TreeItem,
    ThemeIcon,
    EventEmitter,
    CompletionItem,
    CompletionItemKind,
    Hover,
    MarkdownString,
    CodeLens,
    SnippetString,
    WorkspaceEdit,
    CodeAction,
    CodeActionKind,
    ProgressLocation,
    CancellationTokenSource,
    window,
    workspace,
    languages,
    commands,
    env,
};
