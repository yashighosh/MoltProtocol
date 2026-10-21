import ts from "typescript";

export type CallSite = { name: string; line: number };
export type ParsedFunction = {
  name: string;
  startLine: number;
  endLine: number;
  calls: CallSite[];
};
export type ParsedImport = { specifier: string; names: string[]; line: number };
export type ParsedSource = {
  imports: ParsedImport[];
  functions: ParsedFunction[];
  commentText: string;
  commentChars: number;
  codeChars: number;
  branchCount: number;
  emptyCatches: { line: number }[];
  todos: { line: number; text: string }[];
  duplicateCalls: { functionName: string; callee: string; count: number; line: number }[];
};

function scriptKind(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".ts")) return ts.ScriptKind.TS;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function calleeName(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    const left = calleeName(expression.expression);
    return left ? `${left}.${expression.name.text}` : expression.name.text;
  }
  return "";
}

function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node);
}

function functionName(node: ts.FunctionLikeDeclaration, source: ts.SourceFile): string {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
    if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  }
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  return `anonymous@${lineOf(source, node)}`;
}

export function parseSource(filePath: string, text: string): ParsedSource | { error: string } {
  const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKind(filePath));
  const diagnostics = (source as ts.SourceFile & { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? [];
  if (diagnostics.length > 0) {
    const diagnostic = diagnostics[0];
    const message = typeof diagnostic.messageText === "string" ? diagnostic.messageText : diagnostic.messageText.messageText;
    return { error: `Syntax error: ${message}` };
  }

  const imports: ParsedImport[] = [];
  const functions: ParsedFunction[] = [];
  const emptyCatches: { line: number }[] = [];
  let branchCount = 0;

  function walkFunction(node: ts.Node, bucket: CallSite[]) {
    if (ts.isIfStatement(node) || ts.isForStatement(node) || ts.isWhileStatement(node) || ts.isConditionalExpression(node) || ts.isSwitchStatement(node)) {
      branchCount += 1;
    }
    if (ts.isCatchClause(node) && node.block.statements.length === 0) {
      emptyCatches.push({ line: lineOf(source, node) });
    }
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression);
      if (name) bucket.push({ name, line: lineOf(source, node) });
    }
    node.forEachChild((child) => {
      if (isFunctionLike(child)) return;
      walkFunction(child, bucket);
    });
  }

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const names: string[] = [];
      const clause = node.importClause;
      if (clause?.name) names.push(clause.name.text);
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) names.push(element.name.text);
      }
      if (bindings && ts.isNamespaceImport(bindings)) names.push(bindings.name.text);
      imports.push({ specifier: node.moduleSpecifier.text, names, line: lineOf(source, node) });
    }

    if (isFunctionLike(node) && (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isVariableDeclaration(node.parent))) {
      const calls: CallSite[] = [];
      const before = branchCount;
      walkFunction(node.body ?? node, calls);
      functions.push({
        name: functionName(node, source),
        startLine: lineOf(source, node),
        endLine: source.getLineAndCharacterOfPosition(node.end).line + 1,
        calls,
      });
      branchCount = before + Math.max(branchCount - before, 0);
    }

    node.forEachChild(visit);
  }

  visit(source);

  const comments = [...text.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g)].map((match) =>
    match[0].replace(/^\/\*\*?/, "").replace(/\*\/$/, "").replace(/^\s*\/\/\s?/gm, "").replace(/^\s*\*\s?/gm, "").trim(),
  );
  const commentText = comments.filter(Boolean).join("\n");
  const todos = text.split(/\r?\n/).flatMap((line, index) => {
    const marker = line.match(/\b(TODO|FIXME|HACK)\b[:\s-]*(.*)$/);
    return marker ? [{ line: index + 1, text: line.trim() }] : [];
  });

  const duplicateCalls = functions.flatMap((fn) => {
    const counts = new Map<string, { count: number; line: number }>();
    for (const call of fn.calls) {
      const current = counts.get(call.name) ?? { count: 0, line: call.line };
      current.count += 1;
      counts.set(call.name, current);
    }
    return [...counts.entries()]
      .filter(([, value]) => value.count >= 2)
      .map(([callee, value]) => ({ functionName: fn.name, callee, count: value.count, line: value.line }));
  });

  return {
    imports,
    functions,
    commentText,
    commentChars: commentText.length,
    codeChars: Math.max(text.replace(/\s+/g, "").length, 1),
    branchCount,
    emptyCatches,
    todos,
    duplicateCalls,
  };
}

const SOURCE_EXTENSIONS = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];

export function resolveRelative(fromPath: string, specifier: string, files: Set<string>): string | null {
  if (!specifier.startsWith(".")) return null;
  const fromDir = fromPath.split("/").slice(0, -1);
  const parts = [...fromDir, ...specifier.split("/")].filter((part) => part !== "." && part !== "");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else resolved.push(part);
  }
  const base = resolved.join("/");
  const candidates = [base, ...SOURCE_EXTENSIONS.map((ext) => base + ext), ...SOURCE_EXTENSIONS.map((ext) => `${base}/index${ext}`)];
  return candidates.find((candidate) => files.has(candidate)) ?? null;
}
