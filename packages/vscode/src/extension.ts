import {
  canonicalizeSource,
  createDefaultTheme,
  findCanonicalEquivalent,
  extractClassOccurrences,
  tokenizeClasses,
} from "@tailwind-canonicalize/compiler";
import * as vscode from "vscode";

const DIAG_COLLECTION = "tailwind-canonicalize";

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection(DIAG_COLLECTION);
  context.subscriptions.push(diagnostics);

  const theme = createDefaultTheme();

  const refresh = (doc: vscode.TextDocument) => {
    const config = vscode.workspace.getConfiguration("tailwindCanonicalize");
    if (!config.get<boolean>("enableDiagnostics", true)) {
      diagnostics.delete(doc.uri);
      return;
    }
    if (!isSupported(doc)) {
      return;
    }

    const text = doc.getText();
    const { occurrences } = extractClassOccurrences(text, { filePath: doc.fileName });
    const diags: vscode.Diagnostic[] = [];

    for (const occ of occurrences) {
      const tokens = tokenizeClasses(occ.raw);
      let searchFrom = 0;
      for (const token of tokens) {
        const match = findCanonicalEquivalent(token, { theme });
        if (!match || match.canonical === token) {
          continue;
        }
        const rel = occ.raw.indexOf(token, searchFrom);
        if (rel === -1) {
          continue;
        }
        searchFrom = rel + token.length;
        const startOffset = occ.start + rel;
        const endOffset = startOffset + token.length;
        const start = doc.positionAt(startOffset);
        const end = doc.positionAt(endOffset);
        const diag = new vscode.Diagnostic(
          new vscode.Range(start, end),
          `Can canonicalize to '${match.canonical}'`,
          vscode.DiagnosticSeverity.Hint,
        );
        diag.code = "tailwind-canonicalize";
        diag.source = "tailwind-canonicalize";
        diags.push(diag);
      }
    }

    diagnostics.set(doc.uri, diags);
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => refresh(e.document)),
    vscode.workspace.onDidOpenTextDocument((doc) => refresh(doc)),
    vscode.window.onDidChangeActiveTextEditor((ed) => {
      if (ed) {
        refresh(ed.document);
      }
    }),
  );

  for (const doc of vscode.workspace.textDocuments) {
    refresh(doc);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("tailwind-canonicalize.canonicalizeDocument", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const doc = editor.document;
      const result = canonicalizeSource(doc.getText(), {
        filePath: doc.fileName,
        theme,
      });
      if (!result.changed) {
        vscode.window.showInformationMessage("Already canonical");
        return;
      }
      const full = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
      await editor.edit((b) => b.replace(full, result.code));
    }),
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      [
        { language: "typescriptreact" },
        { language: "javascriptreact" },
        { language: "typescript" },
        { language: "javascript" },
        { language: "html" },
        { language: "vue" },
      ],
      new CanonicalizeCodeActionProvider(theme),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
  );
}

export function deactivate(): void {
  // no-op
}

function isSupported(doc: vscode.TextDocument): boolean {
  return [
    "typescriptreact",
    "javascriptreact",
    "typescript",
    "javascript",
    "html",
    "vue",
    "astro",
    "svelte",
    "mdx",
  ].includes(doc.languageId);
}

class CanonicalizeCodeActionProvider implements vscode.CodeActionProvider {
  constructor(private readonly theme: ReturnType<typeof createDefaultTheme>) {}

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    for (const diag of context.diagnostics) {
      if (diag.source !== "tailwind-canonicalize") {
        continue;
      }
      const token = document.getText(diag.range);
      const match = findCanonicalEquivalent(token, { theme: this.theme });
      if (!match) {
        continue;
      }
      const action = new vscode.CodeAction(
        `Convert to canonical Tailwind class '${match.canonical}'`,
        vscode.CodeActionKind.QuickFix,
      );
      action.diagnostics = [diag];
      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(document.uri, diag.range, match.canonical);
      action.isPreferred = true;
      actions.push(action);
    }
    return actions;
  }
}
