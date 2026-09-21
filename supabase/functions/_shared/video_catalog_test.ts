import {
  validateStudioModelInputs,
  validateStudioParameters,
} from "./studio.ts";
import { buildKieCreateBody } from "./kie.ts";
import { calculateStudioCredits } from "./pricing.ts";
const models = JSON.parse(
  Deno.readTextFileSync(
    new URL(
      "../../../maintenance/kie-video-audit/catalog.json",
      import.meta.url,
    ),
  ),
);
for (const model of models) {
  Deno.test(`${model.name}: contract matches the archived official Kie schema`, () => {
    const doc = JSON.parse(
      Deno.readTextFileSync(
        new URL(
          `../../../maintenance/kie-video-audit/${
            model.provider_model_id.replaceAll("/", "__")
          }.json`,
          import.meta.url,
        ),
      ),
    );
    for (
      const [key, rule] of Object.entries(
        model.parameter_schema.properties,
      ) as Array<[string, { type: string; enum?: unknown[] }]>
    ) {
      const source = doc.input.properties[key];
      if (!source || source.type !== rule.type) {
        throw Error(`Undocumented parameter/type: ${key}`);
      }
      if (
        source.enum && rule.enum?.some((value) => !source.enum.includes(value))
      ) throw Error(`Undocumented option: ${key}`);
    }
    if (
      model.provider_config.inputField &&
      !doc.input.properties[model.provider_config.inputField]
    ) throw Error("Undocumented reference field");
    for (const key of doc.input.required || []) {
      if (
        key !== "prompt" && key !== model.provider_config.inputField &&
        !model.parameter_schema.properties[key]
      ) throw Error(`Missing required provider field: ${key}`);
    }
  });
  Deno.test(`${model.name}: every resolution, duration, ratio and boolean reaches Kie with an authoritative price`, () => {
    const entries = Object.entries(model.parameter_schema.properties) as Array<
      [string, { enum?: unknown[]; type: string }]
    >;
    let cases: Record<string, unknown>[] = [{}];
    for (const [key, rule] of entries) {
      cases = cases.flatMap((c) =>
        (rule.enum || [false, true]).map((v) => ({ ...c, [key]: v }))
      );
    }
    for (const parameters of cases) {
      const forbidden = (model.parameter_schema.forbiddenCombinations || [])
        .some((c: Record<string, unknown>) =>
          Object.entries(c).every(([k, v]) => parameters[k] === v)
        );
      if (forbidden) {
        let rejected = false;
        try {
          validateStudioParameters(parameters, model.parameter_schema);
        } catch {
          rejected = true;
        }
        if (!rejected) throw Error("Invalid combination accepted");
        continue;
      }
      validateStudioParameters(parameters, model.parameter_schema);
      const lookup = model.credit_rules.keys.map((k: string) =>
        String(parameters[k])
      ).join("|");
      if (!model.credit_rules.rates[lookup]) {
        throw Error(`Missing price ${lookup}`);
      }
      const price = calculateStudioCredits(
        model.credit_cost,
        parameters,
        model.credit_rules,
      );
      if (!Number.isSafeInteger(price) || price < 1) {
        throw Error("Invalid quote");
      }
      const body = buildKieCreateBody({
        clientJobId: "test",
        model: model.provider_model_id,
        mediaType: "video",
        prompt: "A test video",
        parameters,
        config: model.provider_config,
        inputs: model.provider_config.inputField
          ? [{
            id: "image",
            url: "https://example.com/image.png",
            mimeType: "image/png",
          }]
          : [],
      }, "https://example.com/callback");
      for (const [k, v] of Object.entries(parameters)) {
        if (body.input[k] !== v) throw Error(`Lost ${k}`);
      }
      if (body.model !== model.provider_model_id) throw Error("Wrong model");
    }
  });
  Deno.test(`${model.name}: rejects unsupported inputs and settings before charging`, () => {
    const reject = (fn: () => void) => {
      let rejected = false;
      try {
        fn();
      } catch {
        rejected = true;
      }
      if (!rejected) throw Error("Expected rejection");
    };
    reject(() =>
      validateStudioParameters({
        ...model.provider_config.defaultInput,
        unexpected: true,
      }, model.parameter_schema)
    );
    reject(() =>
      validateStudioParameters({
        ...model.provider_config.defaultInput,
        duration: 0,
      }, model.parameter_schema)
    );
    reject(() =>
      validateStudioModelInputs(model.provider_config, "A test video", null, [{
        mime_type: "video/mp4",
      }])
    );
    if (model.provider_config.minInputs) {
      reject(() =>
        validateStudioModelInputs(
          model.provider_config,
          "A test video",
          null,
          [],
        )
      );
    }
    validateStudioModelInputs(
      model.provider_config,
      "A test video",
      null,
      model.provider_config.minInputs ? [{ mime_type: "image/png" }] : [],
    );
  });
}
