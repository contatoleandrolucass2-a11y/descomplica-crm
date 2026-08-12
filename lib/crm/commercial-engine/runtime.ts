import { hashCanonicalJson } from "./canonical.ts";
import {
  commercialPolicyDocumentSchema,
  type CommercialExpression,
  type CommercialPolicyDefinition,
  type CommercialPolicyDocument,
  type CommercialValueType,
} from "./contract.ts";
import {
  addCommercialDecimals,
  commercialDecimalIsInteger,
  commercialDecimalToOutputString,
  commercialDecimalToString,
  compareCommercialDecimals,
  divideCommercialDecimals,
  multiplyCommercialDecimals,
  parseCommercialDecimal,
  roundCommercialDecimal,
  subtractCommercialDecimals,
  CommercialDecimalError,
  type DecimalValue,
} from "./decimal.ts";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const MAX_EXPRESSION_DEPTH = 24;
const MAX_EXPRESSION_NODES = 512;
const MAX_STRING_LENGTH = 1_000;
const DAY_IN_MS = 86_400_000;

type RuntimeValue =
  | { valueType: "decimal"; value: DecimalValue }
  | { valueType: "boolean"; value: boolean }
  | { valueType: "string"; value: string }
  | { valueType: "date"; value: string };

type CompiledPolicy = {
  document: CommercialPolicyDocument;
  runtimeVersion: 1;
  inputTypes: ReadonlyMap<string, CommercialValueType>;
  outputTypes: ReadonlyMap<string, CommercialValueType>;
};

const verifiedPolicyAttestation = Symbol("commercial-policy-attestation-v1");

type VerifiedPolicyAttestation = Readonly<{
  compiled: CompiledPolicy;
  policyHash: string;
  goldenReportHash: string;
}>;

export type CommercialPolicyExecutionOutput = Record<string, string | boolean>;

export type VerifiedCommercialPolicy = {
  document: CommercialPolicyDocument;
  policyHash: string;
  goldenReportHash: string;
  goldenCaseCount: number;
  readonly [verifiedPolicyAttestation]: VerifiedPolicyAttestation;
};

export class CommercialPolicyRuntimeError extends Error {}

export class CommercialPolicyIntegrityError extends Error {}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function strictDate(value: string): string {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new CommercialPolicyRuntimeError("date value is invalid");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2200) {
    throw new CommercialPolicyRuntimeError("date value is outside the supported range");
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new CommercialPolicyRuntimeError("date value is invalid");
  }
  return value;
}

function dateToEpochDay(value: string): number {
  const normalized = strictDate(value);
  const [year, month, day] = normalized.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!) / DAY_IN_MS;
}

function epochDayToDate(epochDay: number): string {
  if (!Number.isSafeInteger(epochDay)) {
    throw new CommercialPolicyRuntimeError("date result is outside the supported range");
  }
  const date = new Date(epochDay * DAY_IN_MS);
  return strictDate(date.toISOString().slice(0, 10));
}

function normalizeScalar(valueType: CommercialValueType, value: unknown): RuntimeValue {
  if (valueType === "decimal") {
    if (typeof value !== "string") {
      throw new CommercialPolicyRuntimeError("decimal values must use exact strings");
    }
    return { valueType, value: parseCommercialDecimal(value) };
  }
  if (valueType === "boolean") {
    if (typeof value !== "boolean") {
      throw new CommercialPolicyRuntimeError("boolean value is invalid");
    }
    return { valueType, value };
  }
  if (
    typeof value !== "string" ||
    value.length > MAX_STRING_LENGTH ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw new CommercialPolicyRuntimeError(`${valueType} value is invalid`);
  }
  return valueType === "date" ? { valueType, value: strictDate(value) } : { valueType, value };
}

function serializeRuntimeValue(value: RuntimeValue): string | boolean {
  if (value.valueType === "decimal") return commercialDecimalToOutputString(value.value);
  if (
    value.valueType === "string" &&
    (value.value.length > MAX_STRING_LENGTH || CONTROL_CHARACTER_PATTERN.test(value.value))
  ) {
    throw new CommercialPolicyRuntimeError("string result is outside the supported range");
  }
  return value.value;
}

function assertType(
  actual: CommercialValueType,
  expected: CommercialValueType,
  operation: string,
): void {
  if (actual !== expected) {
    throw new CommercialPolicyRuntimeError(`${operation} received an incompatible value type`);
  }
}

function inferExpressionType(
  expression: CommercialExpression,
  inputTypes: ReadonlyMap<string, CommercialValueType>,
  stats: { nodes: number },
  depth = 1,
): CommercialValueType {
  stats.nodes += 1;
  if (depth > MAX_EXPRESSION_DEPTH || stats.nodes > MAX_EXPRESSION_NODES) {
    throw new CommercialPolicyRuntimeError("policy expression complexity exceeds the limit");
  }

  const infer = (child: CommercialExpression) =>
    inferExpressionType(child, inputTypes, stats, depth + 1);

  if (expression.op === "literal") {
    normalizeScalar(expression.valueType, expression.value);
    return expression.valueType;
  }
  if (expression.op === "input") {
    const valueType = inputTypes.get(expression.key);
    if (!valueType) throw new CommercialPolicyRuntimeError("expression references unknown input");
    return valueType;
  }
  if (
    expression.op === "add" ||
    expression.op === "multiply" ||
    expression.op === "min" ||
    expression.op === "max"
  ) {
    for (const argument of expression.args) assertType(infer(argument), "decimal", expression.op);
    return "decimal";
  }
  if (expression.op === "and" || expression.op === "or") {
    for (const argument of expression.args) assertType(infer(argument), "boolean", expression.op);
    return "boolean";
  }
  if (expression.op === "concat") {
    for (const argument of expression.args) assertType(infer(argument), "string", expression.op);
    return "string";
  }
  if (expression.op === "subtract") {
    assertType(infer(expression.left), "decimal", expression.op);
    assertType(infer(expression.right), "decimal", expression.op);
    return "decimal";
  }
  if (expression.op === "divide") {
    assertType(infer(expression.numerator), "decimal", expression.op);
    assertType(infer(expression.denominator), "decimal", expression.op);
    return "decimal";
  }
  if (expression.op === "round") {
    assertType(infer(expression.value), "decimal", expression.op);
    return "decimal";
  }
  if (expression.op === "compare") {
    const leftType = infer(expression.left);
    const rightType = infer(expression.right);
    assertType(rightType, leftType, expression.op);
    if (!["eq", "neq"].includes(expression.comparator) && !["decimal", "date"].includes(leftType)) {
      throw new CommercialPolicyRuntimeError("ordered comparison requires decimal or date values");
    }
    return "boolean";
  }
  if (expression.op === "not") {
    assertType(infer(expression.value), "boolean", expression.op);
    return "boolean";
  }
  if (expression.op === "if") {
    assertType(infer(expression.condition), "boolean", expression.op);
    const thenType = infer(expression.then);
    assertType(infer(expression.else), thenType, expression.op);
    return thenType;
  }
  if (expression.op === "date_add_days" || expression.op === "date_add_months") {
    assertType(infer(expression.date), "date", expression.op);
    assertType(infer(expression.amount), "decimal", expression.op);
    return "date";
  }

  if (expression.op === "date_diff_days") {
    assertType(infer(expression.start), "date", expression.op);
    assertType(infer(expression.end), "date", expression.op);
    return "decimal";
  }

  throw new CommercialPolicyRuntimeError("policy expression operation is unsupported");
}

function compilePolicyV1(document: CommercialPolicyDocument): CompiledPolicy {
  const inputTypes = new Map(
    document.definition.inputs.map((input) => [input.key, input.valueType] as const),
  );
  const outputTypes = new Map(
    document.definition.outputs.map((output) => [output.key, output.valueType] as const),
  );
  const stats = { nodes: 0 };
  for (const output of document.definition.outputs) {
    assertType(
      inferExpressionType(output.expression, inputTypes, stats),
      output.valueType,
      `output ${output.key}`,
    );
  }
  return { document, runtimeVersion: 1, inputTypes, outputTypes };
}

function exactRecordKeys(record: Record<string, unknown>, expectedKeys: Iterable<string>): void {
  const expected = [...expectedKeys].sort();
  const actual = Object.keys(record).sort();
  if (expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) {
    throw new CommercialPolicyRuntimeError("record keys do not match policy contract");
  }
}

function normalizeInput(
  input: Record<string, unknown>,
  inputTypes: ReadonlyMap<string, CommercialValueType>,
): ReadonlyMap<string, RuntimeValue> {
  exactRecordKeys(input, inputTypes.keys());
  return new Map(
    [...inputTypes].map(
      ([key, valueType]) => [key, normalizeScalar(valueType, input[key])] as const,
    ),
  );
}

function decimalFromValue(value: RuntimeValue, operation: string): DecimalValue {
  if (value.valueType !== "decimal") {
    throw new CommercialPolicyRuntimeError(`${operation} received an incompatible value type`);
  }
  return value.value;
}

function booleanFromValue(value: RuntimeValue, operation: string): boolean {
  if (value.valueType !== "boolean") {
    throw new CommercialPolicyRuntimeError(`${operation} received an incompatible value type`);
  }
  return value.value;
}

function stringFromValue(value: RuntimeValue, valueType: "string" | "date", operation: string) {
  if (value.valueType !== valueType) {
    throw new CommercialPolicyRuntimeError(`${operation} received an incompatible value type`);
  }
  return value.value;
}

function decimalToBoundedInteger(value: DecimalValue, limit: number, operation: string): number {
  if (!commercialDecimalIsInteger(value)) {
    throw new CommercialPolicyRuntimeError(`${operation} requires an integer amount`);
  }
  const numeric = Number(commercialDecimalToString(value));
  if (!Number.isSafeInteger(numeric) || Math.abs(numeric) > limit) {
    throw new CommercialPolicyRuntimeError(`${operation} amount is outside the supported range`);
  }
  return numeric;
}

function evaluateExpression(
  expression: CommercialExpression,
  input: ReadonlyMap<string, RuntimeValue>,
): RuntimeValue {
  const evaluate = (child: CommercialExpression) => evaluateExpression(child, input);

  if (expression.op === "literal") return normalizeScalar(expression.valueType, expression.value);
  if (expression.op === "input") {
    const value = input.get(expression.key);
    if (!value) throw new CommercialPolicyRuntimeError("expression references unknown input");
    return value;
  }
  if (expression.op === "add" || expression.op === "multiply") {
    const values = expression.args.map((argument) =>
      decimalFromValue(evaluate(argument), expression.op),
    );
    const identity =
      expression.op === "add" ? parseCommercialDecimal("0") : parseCommercialDecimal("1");
    const value = values.reduce(
      expression.op === "add" ? addCommercialDecimals : multiplyCommercialDecimals,
      identity,
    );
    return { valueType: "decimal", value };
  }
  if (expression.op === "min" || expression.op === "max") {
    const values = expression.args.map((argument) =>
      decimalFromValue(evaluate(argument), expression.op),
    );
    const value = values.reduce((selected, candidate) => {
      const comparison = compareCommercialDecimals(candidate, selected);
      return expression.op === "min"
        ? comparison < 0
          ? candidate
          : selected
        : comparison > 0
          ? candidate
          : selected;
    });
    return { valueType: "decimal", value };
  }
  if (expression.op === "and" || expression.op === "or") {
    const values = expression.args.map((argument) =>
      booleanFromValue(evaluate(argument), expression.op),
    );
    return {
      valueType: "boolean",
      value: expression.op === "and" ? values.every(Boolean) : values.some(Boolean),
    };
  }
  if (expression.op === "concat") {
    const value = expression.args
      .map((argument) => stringFromValue(evaluate(argument), "string", expression.op))
      .join("");
    if (value.length > MAX_STRING_LENGTH || CONTROL_CHARACTER_PATTERN.test(value)) {
      throw new CommercialPolicyRuntimeError("concat result is outside the supported range");
    }
    return {
      valueType: "string",
      value,
    };
  }
  if (expression.op === "subtract") {
    return {
      valueType: "decimal",
      value: subtractCommercialDecimals(
        decimalFromValue(evaluate(expression.left), expression.op),
        decimalFromValue(evaluate(expression.right), expression.op),
      ),
    };
  }
  if (expression.op === "divide") {
    return {
      valueType: "decimal",
      value: divideCommercialDecimals(
        decimalFromValue(evaluate(expression.numerator), expression.op),
        decimalFromValue(evaluate(expression.denominator), expression.op),
        expression.scale,
        expression.rounding,
      ),
    };
  }
  if (expression.op === "round") {
    return {
      valueType: "decimal",
      value: roundCommercialDecimal(
        decimalFromValue(evaluate(expression.value), expression.op),
        expression.scale,
        expression.rounding,
      ),
    };
  }
  if (expression.op === "compare") {
    const left = evaluate(expression.left);
    const right = evaluate(expression.right);
    if (left.valueType !== right.valueType) {
      throw new CommercialPolicyRuntimeError("compare received incompatible value types");
    }
    const comparison =
      left.valueType === "decimal"
        ? compareCommercialDecimals(left.value, (right as typeof left).value)
        : left.valueType === "date"
          ? dateToEpochDay(left.value) - dateToEpochDay((right as typeof left).value)
          : left.value === (right as typeof left).value
            ? 0
            : -1;
    return {
      valueType: "boolean",
      value:
        expression.comparator === "eq"
          ? comparison === 0
          : expression.comparator === "neq"
            ? comparison !== 0
            : expression.comparator === "lt"
              ? comparison < 0
              : expression.comparator === "lte"
                ? comparison <= 0
                : expression.comparator === "gt"
                  ? comparison > 0
                  : comparison >= 0,
    };
  }
  if (expression.op === "not") {
    return {
      valueType: "boolean",
      value: !booleanFromValue(evaluate(expression.value), expression.op),
    };
  }
  if (expression.op === "if") {
    return booleanFromValue(evaluate(expression.condition), expression.op)
      ? evaluate(expression.then)
      : evaluate(expression.else);
  }
  if (expression.op === "date_add_days") {
    const date = stringFromValue(evaluate(expression.date), "date", expression.op);
    const amount = decimalToBoundedInteger(
      decimalFromValue(evaluate(expression.amount), expression.op),
      36_500,
      expression.op,
    );
    return { valueType: "date", value: epochDayToDate(dateToEpochDay(date) + amount) };
  }
  if (expression.op === "date_add_months") {
    const date = stringFromValue(evaluate(expression.date), "date", expression.op);
    const amount = decimalToBoundedInteger(
      decimalFromValue(evaluate(expression.amount), expression.op),
      1_200,
      expression.op,
    );
    const [year, month, day] = date.split("-").map(Number);
    const targetMonthIndex = year! * 12 + (month! - 1) + amount;
    const targetYear = Math.floor(targetMonthIndex / 12);
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    if (day! > lastDay && expression.overflow === "reject") {
      throw new CommercialPolicyRuntimeError("date month overflow is rejected by policy");
    }
    const targetDay = Math.min(day!, lastDay);
    return {
      valueType: "date",
      value: strictDate(
        `${String(targetYear).padStart(4, "0")}-${String(targetMonth + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`,
      ),
    };
  }

  if (expression.op === "date_diff_days") {
    const start = stringFromValue(evaluate(expression.start), "date", expression.op);
    const end = stringFromValue(evaluate(expression.end), "date", expression.op);
    return {
      valueType: "decimal",
      value: parseCommercialDecimal(String(dateToEpochDay(end) - dateToEpochDay(start))),
    };
  }

  throw new CommercialPolicyRuntimeError("policy expression operation is unsupported");
}

function executeCompiledPolicyV1(
  compiled: CompiledPolicy,
  input: Record<string, unknown>,
): CommercialPolicyExecutionOutput {
  const normalizedInput = normalizeInput(input, compiled.inputTypes);
  return Object.fromEntries(
    compiled.document.definition.outputs.map((output) => [
      output.key,
      serializeRuntimeValue(evaluateExpression(output.expression, normalizedInput)),
    ]),
  );
}

type CommercialPolicyRuntimeImplementation = Readonly<{
  compile: (document: CommercialPolicyDocument) => CompiledPolicy;
  execute: (
    compiled: CompiledPolicy,
    input: Record<string, unknown>,
  ) => CommercialPolicyExecutionOutput;
}>;

const COMMERCIAL_POLICY_RUNTIME_DISPATCH = Object.freeze({
  1: Object.freeze({
    compile: compilePolicyV1,
    execute: executeCompiledPolicyV1,
  } satisfies CommercialPolicyRuntimeImplementation),
});

function resolveCommercialPolicyRuntime(
  runtimeVersion: unknown,
): CommercialPolicyRuntimeImplementation {
  if (runtimeVersion !== 1) {
    throw new CommercialPolicyRuntimeError("commercial policy runtime version is unsupported");
  }
  return COMMERCIAL_POLICY_RUNTIME_DISPATCH[1];
}

function compilePolicy(document: CommercialPolicyDocument): CompiledPolicy {
  return resolveCommercialPolicyRuntime(document.definition.runtimeVersion).compile(document);
}

function executeCompiledPolicy(
  compiled: CompiledPolicy,
  input: Record<string, unknown>,
): CommercialPolicyExecutionOutput {
  if (compiled.runtimeVersion !== compiled.document.definition.runtimeVersion) {
    throw new CommercialPolicyRuntimeError("compiled policy runtime version does not match");
  }
  return resolveCommercialPolicyRuntime(compiled.runtimeVersion).execute(compiled, input);
}

function normalizeExpected(
  expected: Record<string, unknown>,
  outputTypes: ReadonlyMap<string, CommercialValueType>,
): CommercialPolicyExecutionOutput {
  exactRecordKeys(expected, outputTypes.keys());
  return Object.fromEntries(
    [...outputTypes].map(([key, valueType]) => {
      const normalized = serializeRuntimeValue(normalizeScalar(valueType, expected[key]));
      if (valueType === "decimal" && expected[key] !== normalized) {
        throw new CommercialPolicyRuntimeError(
          `golden case output ${key} must use canonical decimal notation`,
        );
      }
      return [key, normalized];
    }),
  );
}

export function canonicalizeCommercialPolicyDocument(input: unknown): CommercialPolicyDocument {
  const parsed = commercialPolicyDocumentSchema.parse(input);
  return {
    ...parsed,
    definition: {
      ...parsed.definition,
      inputs: [...parsed.definition.inputs].sort((left, right) =>
        Buffer.compare(Buffer.from(left.key, "utf8"), Buffer.from(right.key, "utf8")),
      ),
      outputs: [...parsed.definition.outputs].sort((left, right) =>
        Buffer.compare(Buffer.from(left.key, "utf8"), Buffer.from(right.key, "utf8")),
      ),
    },
    goldenCases: [...parsed.goldenCases].sort((left, right) =>
      Buffer.compare(Buffer.from(left.caseKey, "utf8"), Buffer.from(right.caseKey, "utf8")),
    ),
  };
}

export function verifyCommercialPolicyDocument(input: unknown): VerifiedCommercialPolicy {
  const document = deepFreeze(canonicalizeCommercialPolicyDocument(input));
  const compiled = compilePolicy(document);
  const policyHash = hashCanonicalJson(document);
  const cases = document.goldenCases.map((goldenCase) => {
    const actual = executeCompiledPolicy(compiled, goldenCase.input);
    const expected = normalizeExpected(goldenCase.expected, compiled.outputTypes);
    if (hashCanonicalJson(actual) !== hashCanonicalJson(expected)) {
      throw new CommercialPolicyRuntimeError(`golden case ${goldenCase.caseKey} failed`);
    }
    return {
      caseKey: goldenCase.caseKey,
      inputHash: hashCanonicalJson(goldenCase.input),
      outputHash: hashCanonicalJson(actual),
    };
  });
  const goldenReportHash = hashCanonicalJson({
    runtimeVersion: compiled.runtimeVersion,
    policyHash,
    cases,
  });

  return {
    document,
    policyHash,
    goldenReportHash,
    goldenCaseCount: cases.length,
    [verifiedPolicyAttestation]: Object.freeze({ compiled, policyHash, goldenReportHash }),
  };
}

export function executeVerifiedCommercialPolicy(
  verified: VerifiedCommercialPolicy,
  input: Record<string, unknown>,
): CommercialPolicyExecutionOutput {
  try {
    const attestation = verified[verifiedPolicyAttestation];
    if (
      !attestation ||
      attestation.compiled.document !== verified.document ||
      attestation.policyHash !== verified.policyHash ||
      attestation.goldenReportHash !== verified.goldenReportHash ||
      hashCanonicalJson(verified.document) !== verified.policyHash
    ) {
      throw new CommercialPolicyIntegrityError("commercial policy verification is invalid");
    }
    return executeCompiledPolicy(attestation.compiled, input);
  } catch (error) {
    if (error instanceof CommercialPolicyRuntimeError) throw error;
    if (error instanceof CommercialDecimalError) {
      throw new CommercialPolicyRuntimeError("decimal execution was rejected");
    }
    throw error;
  }
}

export function commercialPolicyExecutionHash(output: CommercialPolicyExecutionOutput): string {
  return hashCanonicalJson(output);
}

export function commercialPolicyInputHash(input: Record<string, unknown>): string {
  return hashCanonicalJson(input);
}

export function commercialPolicyDefinitionNodeCount(
  definition: CommercialPolicyDefinition,
): number {
  resolveCommercialPolicyRuntime(definition.runtimeVersion);
  const inputTypes = new Map(
    definition.inputs.map((input) => [input.key, input.valueType] as const),
  );
  const stats = { nodes: 0 };
  for (const output of definition.outputs) {
    inferExpressionType(output.expression, inputTypes, stats);
  }
  return stats.nodes;
}
