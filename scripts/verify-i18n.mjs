import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const localeRoot = join(root, 'src/i18n/locales')
const enabledNamespaces = [
  'layout',
  'common',
  'errors',
  'calendar',
  'dashboard',
  'leaves',
  'approvals',
  'reports',
  'settings',
  'profile',
  'auth',
  'billing',
  'onboarding',
  'platform',
  'platformAuth',
  'public',
]
const visibleStringAttributes = new Set(['alt', 'aria-label', 'placeholder', 'title'])
const scanRoots = ['src/apps', 'src/auth', 'src/components', 'src/entries', 'src/features', 'src/routes']
const failures = []
// namespace -> Set of flattened keys (from en, the canonical resource) —
// populated by verifyLocaleParity and reused by the t()-key-existence pass.
const localeKeysByNamespace = new Map()

function flatten(value, prefix = '') {
  if (value === null || typeof value !== 'object') {
    return [[prefix, value]]
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  )
}

function interpolationTokens(value) {
  if (typeof value !== 'string') return new Set()
  return new Set([...value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]))
}

function verifyLocaleParity() {
  for (const namespace of enabledNamespaces) {
    const enPath = join(localeRoot, 'en', `${namespace}.json`)
    const arPath = join(localeRoot, 'ar', `${namespace}.json`)
    if (!existsSync(enPath) || !existsSync(arPath)) {
      failures.push(`Missing enabled locale resource for namespace: ${namespace}`)
      continue
    }

    const enEntries = new Map(flatten(JSON.parse(readFileSync(enPath, 'utf8'))))
    const arEntries = new Map(flatten(JSON.parse(readFileSync(arPath, 'utf8'))))
    localeKeysByNamespace.set(namespace, new Set(enEntries.keys()))
    const enKeys = [...enEntries.keys()].sort()
    const arKeys = [...arEntries.keys()].sort()
    const missingArabic = enKeys.filter((key) => !arEntries.has(key))
    const extraArabic = arKeys.filter((key) => !enEntries.has(key))
    if (missingArabic.length > 0) {
      failures.push(`${namespace}: Arabic is missing keys: ${missingArabic.join(', ')}`)
    }
    if (extraArabic.length > 0) {
      failures.push(`${namespace}: Arabic has extra keys: ${extraArabic.join(', ')}`)
    }
    for (const key of enKeys) {
      if (typeof enEntries.get(key) !== 'string' || enEntries.get(key).trim() === '') {
        failures.push(`${namespace}: English value is empty at ${key}`)
      }
      if (typeof arEntries.get(key) !== 'string' || arEntries.get(key).trim() === '') {
        failures.push(`${namespace}: Arabic value is empty at ${key}`)
      }
      if (!arEntries.has(key)) continue
      const enTokens = interpolationTokens(enEntries.get(key))
      const arTokens = interpolationTokens(arEntries.get(key))
      const extraTokens = [...arTokens].filter((token) => !enTokens.has(token))
      if (extraTokens.length > 0) {
        failures.push(
          `${namespace}: Arabic value at ${key} has unexpected interpolation token(s): ${extraTokens.join(', ')}`,
        )
      }
      // CLDR "one"/"two" plural forms legitimately bake the count into the
      // word itself in many languages (e.g. Arabic "غيابان" = "two absences"
      // with no digit), so {{count}} is allowed to be dropped there. Every
      // other plural category (and non-plural keys) must keep every token.
      if (/_(?:one|two)$/.test(key)) continue
      const missingTokens = [...enTokens].filter((token) => !arTokens.has(token))
      if (missingTokens.length > 0) {
        failures.push(
          `${namespace}: Arabic value at ${key} is missing interpolation token(s): ${missingTokens.join(', ')}`,
        )
      }
    }
  }
}

function walk(path) {
  if (!existsSync(path)) return []
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name)
    return statSync(child).isDirectory() ? walk(child) : [child]
  })
}

function hasLetters(value) {
  const normalized = value.replace(/&[a-z]+;/gi, '').trim()
  // Exempt only 1-2 letter uppercase strings (e.g. avatar initials like "JD")
  // — 3-letter acronyms ("ETA", "USD") are real, translatable words and must
  // still be flagged.
  if (/^[A-Z]{1,2}$/.test(normalized)) return false
  return /\p{L}/u.test(normalized)
}

function renderedLiterals(expression) {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return [expression]
  }
  if (ts.isParenthesizedExpression(expression)) {
    return renderedLiterals(expression.expression)
  }
  if (ts.isConditionalExpression(expression)) {
    return [
      ...renderedLiterals(expression.whenTrue),
      ...renderedLiterals(expression.whenFalse),
    ]
  }
  if (ts.isBinaryExpression(expression)) {
    if (
      expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      expression.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return renderedLiterals(expression.right)
    }
    if (expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      return [...renderedLiterals(expression.left), ...renderedLiterals(expression.right)]
    }
  }
  if (ts.isTemplateExpression(expression)) {
    return [expression.head, ...expression.templateSpans.map((span) => span.literal)]
  }
  return []
}

function report(sourceFile, node, text) {
  const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
  failures.push(
    `${relative(root, sourceFile.fileName)}:${location.line + 1}: hardcoded visible string ${JSON.stringify(text.trim())}`,
  )
}

function isTranslationCall(expression) {
  if (ts.isIdentifier(expression)) {
    return expression.text === 't'
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text === 't'
  }
  return false
}

function verifyTranslationKeys(sourceFile, node) {
  if (!ts.isCallExpression(node) || !isTranslationCall(node.expression)) return
  const [firstArg] = node.arguments
  if (!firstArg || !ts.isStringLiteral(firstArg)) return

  const raw = firstArg.text
  const separatorIndex = raw.indexOf(':')
  if (separatorIndex === -1) return // no explicit namespace — cannot statically resolve, skip

  const namespace = raw.slice(0, separatorIndex)
  const key = raw.slice(separatorIndex + 1)
  if (!enabledNamespaces.includes(namespace)) {
    const location = sourceFile.getLineAndCharacterOfPosition(firstArg.getStart(sourceFile))
    failures.push(
      `${relative(root, sourceFile.fileName)}:${location.line + 1}: t() references unknown namespace "${namespace}" in "${raw}"`,
    )
    return
  }

  const keys = localeKeysByNamespace.get(namespace) ?? new Set()
  // Plural key families are stored as `key_zero`/`key_one`/... rather than a
  // bare `key`, so also accept any key with that prefix.
  const resolves = keys.has(key) || [...keys].some((candidate) => candidate.startsWith(`${key}_`))
  if (!resolves) {
    const location = sourceFile.getLineAndCharacterOfPosition(firstArg.getStart(sourceFile))
    failures.push(
      `${relative(root, sourceFile.fileName)}:${location.line + 1}: t() references missing key "${raw}"`,
    )
  }
}

function verifyTsxStrings() {
  const files = scanRoots
    .flatMap((path) => walk(join(root, path)))
    .filter((path) => ['.tsx', '.ts'].includes(extname(path)))
    .filter((path) => !/\.(?:test|atdd\.test)\.tsx?$/.test(path))

  for (const file of files) {
    const sourceText = readFileSync(file, 'utf8')
    const isTsx = extname(file) === '.tsx'
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )

    function visit(node) {
      verifyTranslationKeys(sourceFile, node)

      if (ts.isJsxText(node)) {
        const text = node.getText(sourceFile).replace(/\s+/g, ' ').trim()
        if (hasLetters(text)) report(sourceFile, node, text)
      }

      if (ts.isJsxAttribute(node) && visibleStringAttributes.has(node.name.getText(sourceFile))) {
        if (node.initializer && ts.isStringLiteral(node.initializer) && hasLetters(node.initializer.text)) {
          report(sourceFile, node.initializer, node.initializer.text)
        }
        if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          for (const literal of renderedLiterals(node.initializer.expression)) {
            if (hasLetters(literal.text)) report(sourceFile, literal, literal.text)
          }
        }
      }

      if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
        for (const literal of renderedLiterals(node.expression)) {
          if (hasLetters(literal.text)) report(sourceFile, literal, literal.text)
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
  }
}

verifyLocaleParity()
verifyTsxStrings()

if (failures.length > 0) {
  console.error(`i18n verification failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`i18n verification passed: ${enabledNamespaces.length} namespaces and enabled TSX chrome checked.`)
