/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Safe Expression Parser
 *
 * CSP-safe recursive-descent expression parser for the ObjectUI expression engine.
 * Replaces the `new Function()` / `eval()`-based expression compilation with a
 * sandboxed interpreter that works under strict Content Security Policy headers.
 *
 * Operator precedence (lowest → highest):
 *   1. Ternary          a ? b : c
 *   2. Nullish          a ?? b
 *   3. Logical OR       a || b
 *   4. Logical AND      a && b
 *   5. Equality         ===  !==  ==  !=  >  <  >=  <=
 *   6. Addition         a + b   a - b
 *   7. Multiplication   a * b   a / b   a % b
 *   8. Unary            !a   -a   +a   typeof a
 *   9. Member           a.b   a[b]   a?.b   a?.[b]   a(…)   a.b(…)
 *  10. Primary          literals · identifiers · ( expr ) · [ … ]
 *
 * @module evaluator
 * @packageDocumentation
 */

/**
 * A safe subset of global JavaScript objects that are always available in
 * expressions regardless of the provided context.
 *
 * SECURITY: Only read-only, non-executable objects are exposed here.
 * `eval`, `Function`, `window`, `document`, `process`, etc. are NOT included.
 */
const SAFE_GLOBALS: Record<string, unknown> = {
  Math,
  JSON,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  String,
  Number,
  Boolean,
  Array,
};

/**
 * CSP-safe recursive-descent expression parser.
 *
 * Call `evaluate(expression, context)` to parse and execute an expression
 * string against a data context object without any use of `eval()` or
 * `new Function()`.
 *
 * @example
 * ```ts
 * const parser = new SafeExpressionParser();
 * parser.evaluate('data.amount > 1000', { data: { amount: 1500 } }); // true
 * parser.evaluate('stage !== "closed_won" && stage !== "closed_lost"', { stage: 'open' }); // true
 * parser.evaluate('items.filter(i => i.active).length', { items: [{active:true},{active:false}] }); // 1
 * ```
 */
export class SafeExpressionParser {
  private source = '';
  private pos = 0;
  private context: Record<string, unknown> = {};

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Evaluate an expression string against a data context.
   *
   * Safe for use under strict CSP — never uses `eval()` or `new Function()`.
   *
   * @param expression - The expression to evaluate (without `${}` wrapper)
   * @param context    - Variables available to the expression
   * @returns The evaluated result
   * @throws {ReferenceError} When an identifier is not found in the context
   * @throws {TypeError}      On type mismatches (e.g., calling a non-function)
   * @throws {SyntaxError}    On malformed expression syntax
   */
  evaluate(expression: string, context: Record<string, unknown>): unknown {
    this.source = expression.trim();
    this.pos = 0;
    // Safe globals are available but user-provided context takes priority.
    this.context = { ...SAFE_GLOBALS, ...context };

    const result = this.parseTernary();
    this.skipWhitespace();

    if (this.pos < this.source.length) {
      throw new SyntaxError(
        `Unexpected token "${this.source[this.pos]}" at position ${this.pos} in expression "${expression}"`
      );
    }

    return result;
  }

  // ─── Character helpers ────────────────────────────────────────────────────

  private skipWhitespace(): void {
    while (this.pos < this.source.length && /\s/.test(this.source[this.pos])) {
      this.pos++;
    }
  }

  private peek(offset = 0): string {
    return this.source[this.pos + offset] ?? '';
  }

  private consume(): string {
    return this.source[this.pos++] ?? '';
  }

  // ─── Parsing levels ───────────────────────────────────────────────────────

  /** Level 1 — Ternary: `cond ? trueVal : falseVal` (right-associative) */
  private parseTernary(): unknown {
    const cond = this.parseNullish();
    this.skipWhitespace();

    if (this.peek() === '?' && this.peek(1) !== '?') {
      this.pos++; // consume '?'
      this.skipWhitespace();
      const trueVal = this.parseTernary(); // right-associative
      this.skipWhitespace();
      if (this.peek() !== ':') {
        throw new SyntaxError('Expected ":" in ternary expression');
      }
      this.pos++; // consume ':'
      this.skipWhitespace();
      const falseVal = this.parseTernary();
      return cond ? trueVal : falseVal;
    }

    return cond;
  }

  /** Level 2 — Nullish coalescing: `a ?? b` */
  private parseNullish(): unknown {
    let left = this.parseOr();
    this.skipWhitespace();

    while (this.peek() === '?' && this.peek(1) === '?') {
      this.pos += 2;
      this.skipWhitespace();
      const right = this.parseOr();
      left = left ?? right;
      this.skipWhitespace();
    }

    return left;
  }

  /** Level 3 — Logical OR: `a || b` */
  private parseOr(): unknown {
    let left = this.parseAnd();
    this.skipWhitespace();

    while (this.peek() === '|' && this.peek(1) === '|') {
      this.pos += 2;
      this.skipWhitespace();
      const right = this.parseAnd();
      left = left || right;
      this.skipWhitespace();
    }

    return left;
  }

  /** Level 4 — Logical AND: `a && b` */
  private parseAnd(): unknown {
    let left = this.parseEquality();
    this.skipWhitespace();

    while (this.peek() === '&' && this.peek(1) === '&') {
      this.pos += 2;
      this.skipWhitespace();
      const right = this.parseEquality();
      left = left && right;
      this.skipWhitespace();
    }

    return left;
  }

  /** Level 5 — Equality and relational comparisons */
  private parseEquality(): unknown {
    let left = this.parseAddition();
    this.skipWhitespace();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let op: string | null = null;

      if (this.peek() === '=' && this.peek(1) === '=' && this.peek(2) === '=') {
        op = '==='; this.pos += 3;
      } else if (this.peek() === '!' && this.peek(1) === '=' && this.peek(2) === '=') {
        op = '!=='; this.pos += 3;
      } else if (this.peek() === '=' && this.peek(1) === '=') {
        op = '=='; this.pos += 2;
      } else if (this.peek() === '!' && this.peek(1) === '=') {
        op = '!='; this.pos += 2;
      } else if (this.peek() === '>' && this.peek(1) === '=') {
        op = '>='; this.pos += 2;
      } else if (this.peek() === '<' && this.peek(1) === '=') {
        op = '<='; this.pos += 2;
      } else if (this.peek() === '>' && this.peek(1) !== '>') {
        op = '>'; this.pos++;
      } else if (this.peek() === '<' && this.peek(1) !== '<') {
        op = '<'; this.pos++;
      } else {
        break;
      }

      this.skipWhitespace();
      const right = this.parseAddition();

      switch (op) {
        case '===': left = left === right; break;
        case '!==': left = left !== right; break;
        // eslint-disable-next-line eqeqeq
        case '==': left = (left as any) == (right as any); break;
        // eslint-disable-next-line eqeqeq
        case '!=': left = (left as any) != (right as any); break;
        case '>': left = (left as any) > (right as any); break;
        case '<': left = (left as any) < (right as any); break;
        case '>=': left = (left as any) >= (right as any); break;
        case '<=': left = (left as any) <= (right as any); break;
      }

      this.skipWhitespace();
    }

    return left;
  }

  /** Level 6 — Addition / Subtraction */
  private parseAddition(): unknown {
    let left = this.parseMultiplication();
    this.skipWhitespace();

    while (
      (this.peek() === '+' || this.peek() === '-') &&
      this.peek(1) !== '=' // avoid consuming += / -=
    ) {
      const op = this.consume();
      this.skipWhitespace();
      const right = this.parseMultiplication();
      left = op === '+' ? (left as any) + (right as any) : (left as any) - (right as any);
      this.skipWhitespace();
    }

    return left;
  }

  /** Level 7 — Multiplication / Division / Modulo */
  private parseMultiplication(): unknown {
    let left = this.parseUnary();
    this.skipWhitespace();

    while (
      (this.peek() === '*' || this.peek() === '/' || this.peek() === '%') &&
      this.peek(1) !== '='
    ) {
      const op = this.consume();
      this.skipWhitespace();
      const right = this.parseUnary();
      if (op === '*') left = (left as any) * (right as any);
      else if (op === '/') left = (left as any) / (right as any);
      else left = (left as any) % (right as any);
      this.skipWhitespace();
    }

    return left;
  }

  /** Level 8 — Unary operators: `!`, `-`, `+`, `typeof` */
  private parseUnary(): unknown {
    this.skipWhitespace();

    // typeof  (must be checked before identifier parsing to avoid consuming it)
    if (
      this.source.startsWith('typeof', this.pos) &&
      !/[\w$]/.test(this.source[this.pos + 6] ?? '')
    ) {
      this.pos += 6;
      this.skipWhitespace();
      try {
        return typeof this.parseUnary();
      } catch {
        // typeof undeclaredVar === 'undefined' in real JS
        return 'undefined';
      }
    }

    if (this.peek() === '!') {
      this.pos++;
      return !this.parseUnary();
    }

    if (this.peek() === '-') {
      this.pos++;
      return -(this.parseUnary() as any);
    }

    if (this.peek() === '+') {
      this.pos++;
      return +(this.parseUnary() as any);
    }

    return this.parseMember();
  }

  /** Level 9 — Member access, method calls, function calls */
  private parseMember(): unknown {
    let obj = this.parsePrimary();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      this.skipWhitespace();

      const isOptionalDot = this.peek() === '?' && this.peek(1) === '.';
      const isDot = this.peek() === '.' && this.peek(1) !== '.';

      if (isDot || isOptionalDot) {
        // Property / method access:  obj.prop  or  obj?.prop
        if (isOptionalDot) this.pos++; // consume '?' for ?.
        this.pos++; // consume '.'
        this.skipWhitespace();

        const prop = this.parseIdentifierName();
        if (!prop) break;
        this.skipWhitespace();

        if (this.peek() === '(') {
          // Method call: obj.method(args)
          this.pos++; // consume '('
          const args = this.parseArgList();
          if (this.peek() === ')') this.pos++; // consume ')'

          if (obj != null && typeof (obj as any)[prop] === 'function') {
            obj = ((obj as any)[prop] as (...a: unknown[]) => unknown)(...args);
          } else {
            obj = undefined;
          }
        } else {
          // Property access
          obj = obj != null ? (obj as any)[prop] : undefined;
        }

        continue;
      }

      const isOptionalBracket = this.peek() === '?' && this.peek(1) === '[';
      const isBracket = this.peek() === '[';

      if (isBracket || isOptionalBracket) {
        // Bracket access:  obj[key]  or  obj?.[key]
        if (isOptionalBracket) this.pos++; // consume '?' for ?.[
        this.pos++; // consume '['
        this.skipWhitespace();
        const key = this.parseTernary();
        this.skipWhitespace();
        if (this.peek() === ']') this.pos++; // consume ']'

        obj = obj != null ? (obj as any)[key as string | number] : undefined;
        continue;
      }

      if (this.peek() === '(') {
        // Direct function call on a returned value, e.g.  (getFunc())(args)
        this.pos++; // consume '('
        const args = this.parseArgList();
        if (this.peek() === ')') this.pos++; // consume ')'

        if (typeof obj === 'function') {
          obj = (obj as (...a: unknown[]) => unknown)(...args);
        } else {
          throw new TypeError(`${String(obj)} is not a function`);
        }
        continue;
      }

      break;
    }

    return obj;
  }

  /** Level 10 — Primary expressions: literals, identifiers, `(expr)`, `[…]` */
  private parsePrimary(): unknown {
    this.skipWhitespace();
    const ch = this.peek();

    // Parenthesized expression
    if (ch === '(') {
      this.pos++;
      const val = this.parseTernary();
      this.skipWhitespace();
      if (this.peek() === ')') this.pos++;
      return val;
    }

    // Array literal
    if (ch === '[') {
      return this.parseArrayLiteral();
    }

    // String literals
    if (ch === '"' || ch === "'") {
      return this.parseString(ch);
    }

    // Number literals (unary `-` is handled in parseUnary, not here)
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(this.peek(1)))) {
      return this.parseNumber();
    }

    // Identifiers and keywords
    if (/[a-zA-Z_$]/.test(ch)) {
      return this.parseIdentifierOrKeyword();
    }

    throw new SyntaxError(
      `Unexpected character "${ch}" at position ${this.pos}`
    );
  }

  // ─── Literal parsers ──────────────────────────────────────────────────────

  private parseArrayLiteral(): unknown[] {
    this.pos++; // consume '['
    const items: unknown[] = [];
    this.skipWhitespace();

    while (this.peek() !== ']' && this.pos < this.source.length) {
      items.push(this.parseTernary());
      this.skipWhitespace();
      if (this.peek() === ',') {
        this.pos++;
        this.skipWhitespace();
      }
    }

    if (this.peek() === ']') this.pos++;
    return items;
  }

  private parseString(quote: string): string {
    this.pos++; // consume opening quote
    let str = '';

    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];

      if (ch === '\\') {
        this.pos++;
        const esc = this.source[this.pos++] ?? '';
        switch (esc) {
          case 'n':  str += '\n'; break;
          case 't':  str += '\t'; break;
          case 'r':  str += '\r'; break;
          case '\\': str += '\\'; break;
          case '"':  str += '"';  break;
          case "'":  str += "'";  break;
          case '`':  str += '`';  break;
          default:   str += esc;
        }
      } else if (ch === quote) {
        this.pos++; // consume closing quote
        break;
      } else {
        str += ch;
        this.pos++;
      }
    }

    return str;
  }

  private parseNumber(): number {
    const start = this.pos;

    // Integer and decimal parts
    while (this.pos < this.source.length && /[\d.]/.test(this.source[this.pos])) {
      this.pos++;
    }

    // Scientific notation: e+5, E-3
    if (/[eE]/.test(this.source[this.pos] ?? '')) {
      this.pos++;
      if (/[+\-]/.test(this.source[this.pos] ?? '')) this.pos++;
      while (this.pos < this.source.length && /\d/.test(this.source[this.pos])) {
        this.pos++;
      }
    }

    return parseFloat(this.source.slice(start, this.pos));
  }

  // ─── Identifier / keyword parsing ────────────────────────────────────────

  /**
   * Parse an identifier name (stops at non-word characters).
   * Does NOT consume any trailing whitespace or operators.
   */
  private parseIdentifierName(): string {
    const start = this.pos;
    while (this.pos < this.source.length && /[\w$]/.test(this.source[this.pos])) {
      this.pos++;
    }
    return this.source.slice(start, this.pos);
  }

  /** Parse an identifier and resolve keywords, `new`, arrows, calls, lookups. */
  private parseIdentifierOrKeyword(): unknown {
    const id = this.parseIdentifierName();

    // Literal keywords
    switch (id) {
      case 'true':      return true;
      case 'false':     return false;
      case 'null':      return null;
      case 'undefined': return undefined;
      case 'NaN':       return NaN;
      case 'Infinity':  return Infinity;
    }

    // `new` keyword: new Date(), new RegExp(...)
    if (id === 'new') {
      return this.parseNewExpression();
    }

    this.skipWhitespace();

    // Single-param arrow function without parentheses: `param => body`
    if (this.peek() === '=' && this.peek(1) === '>') {
      return this.parseArrowFunction(id);
    }

    // Function call: FN(args)
    if (this.peek() === '(') {
      this.pos++; // consume '('
      const args = this.parseArgList();
      if (this.peek() === ')') this.pos++; // consume ')'

      const fn = this.context[id];
      if (typeof fn === 'function') {
        return (fn as (...a: unknown[]) => unknown)(...args);
      }
      throw new TypeError(`"${id}" is not a function`);
    }

    // Variable lookup — throw on undefined identifier (mirrors JS ReferenceError)
    if (!(id in this.context)) {
      throw new ReferenceError(`${id} is not defined`);
    }

    return this.context[id];
  }

  /**
   * Handle `new ConstructorName(args)` expressions.
   * Only safe constructors (Date, RegExp) are permitted.
   */
  private parseNewExpression(): unknown {
    this.skipWhitespace();
    const constructorName = this.parseIdentifierName();
    this.skipWhitespace();

    let args: unknown[] = [];
    if (this.peek() === '(') {
      this.pos++; // consume '('
      args = this.parseArgList();
      if (this.peek() === ')') this.pos++; // consume ')'
    }

    switch (constructorName) {
      case 'Date':
        return new Date(...(args as ConstructorParameters<typeof Date>));
      case 'RegExp':
        return new RegExp(args[0] as string, args[1] as string | undefined);
      default:
        throw new TypeError(
          `new ${constructorName}() is not supported in expressions`
        );
    }
  }

  /**
   * Parse a single-param arrow function:  `param => bodyExpression`
   *
   * The body is captured as a source substring (without evaluating it at
   * parse time), so that the parameter is properly bound when the returned
   * function is later invoked (e.g., inside `.filter()`, `.map()`, etc.).
   */
  private parseArrowFunction(param: string): (...args: unknown[]) => unknown {
    this.pos += 2; // consume '=>'
    this.skipWhitespace();

    // Scan the source to find where the body expression ends (depth-0 comma
    // or closing bracket/paren), without evaluating it.
    const bodyStart = this.pos;
    const bodyEnd = this.scanExpressionEnd();
    const bodyStr = this.source.slice(bodyStart, bodyEnd).trim();
    this.pos = bodyEnd;

    // Capture the outer context by value so the returned function can use it.
    const capturedContext = this.context;

    return (arg: unknown) => {
      const parser = new SafeExpressionParser();
      return parser.evaluate(bodyStr, {
        ...capturedContext,
        [param]: arg,
      });
    };
  }

  /**
   * Scan forward from the current position to find the end of a sub-expression
   * without evaluating it.  Stops when a depth-0 `,`, `)`, or `]` is found.
   * Correctly skips over string literals and nested brackets.
   *
   * @returns The index just past the last character of the sub-expression.
   */
  private scanExpressionEnd(): number {
    let i = this.pos;
    let depth = 0;
    let inString = false;
    let stringChar = '';

    while (i < this.source.length) {
      const ch = this.source[i];

      if (inString) {
        if (ch === '\\') {
          i += 2; // skip escaped character
          continue;
        }
        if (ch === stringChar) {
          inString = false;
        }
        i++;
        continue;
      }

      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
        i++;
        continue;
      }

      if (ch === '(' || ch === '[') {
        depth++;
      } else if (ch === ')' || ch === ']') {
        if (depth === 0) break; // end of this sub-expression
        depth--;
      } else if (ch === ',' && depth === 0) {
        break; // argument separator
      }

      i++;
    }

    return i;
  }

  /**
   * Parse a comma-separated argument list up to (but not including) the
   * closing `)`.
   */
  private parseArgList(): unknown[] {
    const args: unknown[] = [];
    this.skipWhitespace();

    while (this.peek() !== ')' && this.pos < this.source.length) {
      args.push(this.parseTernary());
      this.skipWhitespace();
      if (this.peek() === ',') {
        this.pos++;
        this.skipWhitespace();
      }
    }

    return args;
  }
}
