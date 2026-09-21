type Value = string | number | boolean;
type Schema = { properties?: Record<string, { enum?: Value[] }>; forbiddenCombinations?: Record<string, Value>[] };
export function validParameterOptions(key: string, options: Value[], parameters: Record<string, Value>, forbidden: Schema["forbiddenCombinations"] = []) {
  // Keep other choices available: changing quality resets a conflicting duration.
  if (key !== "duration") return options;
  return options.filter((value) => !forbidden.some((combination) => Object.entries(combination).every(([field, expected]) => (field === key ? value : parameters[field]) === expected)));
}
export function updateModelParameter(key: string, value: Value, parameters: Record<string, Value>, schema: Schema) {
  const next = { ...parameters, [key]: value };
  for (const [field, rule] of Object.entries(schema.properties || {})) {
    if (!rule.enum) continue;
    const allowed = validParameterOptions(field, rule.enum, next, schema.forbiddenCombinations);
    if (allowed.length && !allowed.includes(next[field])) next[field] = allowed[0];
  }
  return next;
}
