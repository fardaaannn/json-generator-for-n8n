/**
 * Curated parameter schemas for the most common n8n built-in nodes, used to
 * validate the `parameters` object of generated nodes BEYOND the structural
 * checks in validateStructure. Like n8nNodes.js this is intentionally not
 * exhaustive — it covers the node types models generate most often, where a
 * missing or invented parameter silently produces a broken workflow on import.
 *
 * All findings are NON-BLOCKING warnings: they surface in the warnings box and
 * feed the warnings self-heal pass, which lets the model fix its own output.
 *
 * Schema shape (per `n8n-nodes-base.` suffix):
 *   required     string[]  params n8n needs for the node to run at all.
 *                          Only safe, version-stable ones are listed.
 *   requiredAny  string[]  at least ONE of these must be present (e.g. code
 *                          nodes need jsCode OR pythonCode OR functionCode).
 *   known        string[]  top-level parameter catalog (union across
 *                          typeVersions, kept generous to avoid noise).
 *   strict       boolean   flag unknown top-level params. Only set on core
 *                          nodes whose surface is stable; app nodes (slack,
 *                          gmail, ...) vary too much per resource/operation.
 *   enums        object    { param: string[] } — allowed values when the
 *                          param is present as a plain string.
 *   maxVersion   number    highest known typeVersion; higher gets flagged as
 *                          likely invented.
 */

const SCHEMAS = {
  webhook: {
    required: ['path'],
    known: ['path', 'httpMethod', 'responseMode', 'responseData', 'responseCode', 'authentication', 'options', 'isFullPath', 'multipleMethods'],
    strict: true,
    enums: { httpMethod: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] },
    maxVersion: 2,
  },
  httpRequest: {
    required: ['url'],
    known: ['url', 'method', 'authentication', 'genericAuthType', 'nodeCredentialType', 'sendQuery', 'queryParameters', 'sendHeaders', 'headerParameters', 'sendBody', 'bodyParameters', 'contentType', 'specifyBody', 'jsonBody', 'body', 'rawContentType', 'inputDataFieldName', 'options', 'responseFormat', 'jsonParameters', 'queryParametersJson', 'headerParametersJson', 'bodyParametersJson', 'allowUnauthorizedCerts', 'requestMethod', 'ignoreResponseCode', 'splitIntoItems', 'dataPropertyName', 'curlImport', 'provideSslCertificates'],
    strict: true,
    enums: { method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] },
    maxVersion: 4.2,
  },
  scheduleTrigger: {
    required: ['rule'],
    known: ['rule'],
    strict: true,
    maxVersion: 1.2,
  },
  cron: {
    required: ['triggerTimes'],
    known: ['triggerTimes'],
    strict: true,
    maxVersion: 1,
  },
  manualTrigger: { known: [], strict: true, maxVersion: 1 },
  noOp: { known: [], strict: true, maxVersion: 1 },
  set: {
    known: ['mode', 'assignments', 'fields', 'include', 'includeOtherFields', 'includeFields', 'excludeFields', 'options', 'values', 'keepOnlySet', 'duplicateItem', 'duplicateCount'],
    strict: true,
    maxVersion: 3.4,
  },
  code: {
    requiredAny: ['jsCode', 'pythonCode', 'functionCode'],
    known: ['mode', 'language', 'jsCode', 'pythonCode', 'functionCode', 'notice', 'onError'],
    strict: true,
    maxVersion: 2,
  },
  function: {
    requiredAny: ['functionCode'],
    known: ['functionCode'],
    strict: true,
    maxVersion: 1,
  },
  if: {
    required: ['conditions'],
    known: ['conditions', 'combineOperation', 'options', 'looseTypeValidation'],
    strict: true,
    maxVersion: 2.2,
  },
  switch: {
    known: ['rules', 'mode', 'value1', 'dataType', 'output', 'options', 'fallbackOutput', 'numberOutputs', 'looseTypeValidation'],
    strict: true,
    maxVersion: 3.2,
  },
  filter: {
    required: ['conditions'],
    known: ['conditions', 'options', 'looseTypeValidation'],
    strict: true,
    maxVersion: 2.2,
  },
  merge: {
    known: ['mode', 'combineBy', 'combinationMode', 'joinMode', 'mergeByFields', 'outputDataFrom', 'options', 'numberInputs', 'chooseBranchMode', 'fuzzyCompare', 'propertyName1', 'propertyName2'],
    strict: true,
    maxVersion: 3.2,
  },
  splitInBatches: {
    known: ['batchSize', 'options', 'reset'],
    strict: true,
    maxVersion: 3,
  },
  wait: {
    known: ['resume', 'amount', 'unit', 'dateTime', 'options', 'webhookSuffix', 'incomingAuthentication', 'limitWaitTime', 'limitType', 'resumeAmount', 'resumeUnit', 'maxDateAndTime', 'httpMethod', 'responseMode', 'responseData'],
    strict: true,
    enums: { unit: ['seconds', 'minutes', 'hours', 'days'] },
    maxVersion: 1.1,
  },
  respondToWebhook: {
    known: ['respondWith', 'responseBody', 'responseCode', 'options', 'redirectURL', 'responseDataSource'],
    strict: true,
    maxVersion: 1.5,
  },
  emailSend: {
    required: ['toEmail'],
    known: ['fromEmail', 'toEmail', 'ccEmail', 'bccEmail', 'subject', 'text', 'html', 'emailFormat', 'message', 'options', 'attachments', 'replyTo'],
    strict: true,
    maxVersion: 2.1,
  },
  // App nodes: parameter surface depends heavily on resource/operation and
  // typeVersion, so only a generous known-list (no strict flagging) plus
  // common-sense checks are applied.
  slack: {
    known: ['resource', 'operation', 'select', 'channel', 'channelId', 'user', 'text', 'messageType', 'blocksUi', 'attachments', 'otherOptions', 'options', 'authentication', 'ts', 'timestamp', 'name', 'kind', 'title', 'content', 'fileId', 'binaryData', 'binaryPropertyName', 'fileName', 'initialComment', 'channelIds', 'message', 'updateFields', 'filters', 'returnAll', 'limit'],
    maxVersion: 2.3,
  },
  telegram: {
    known: ['resource', 'operation', 'chatId', 'text', 'additionalFields', 'file', 'binaryData', 'binaryPropertyName', 'fileId', 'messageId', 'replyMarkup', 'options', 'updateFields'],
    maxVersion: 1.2,
  },
  gmail: {
    known: ['resource', 'operation', 'sendTo', 'subject', 'message', 'emailType', 'options', 'additionalFields', 'messageId', 'labelIds', 'returnAll', 'limit', 'filters', 'simple', 'format'],
    maxVersion: 2.1,
  },
  googleSheets: {
    known: ['resource', 'operation', 'documentId', 'sheetName', 'columns', 'dataMode', 'options', 'filtersUI', 'combineFilters', 'dataStartRow', 'headerRow', 'range', 'keyRow', 'dataToSend', 'fieldsUi', 'valueInputMode', 'valueRenderMode', 'authentication'],
    maxVersion: 4.5,
  },
};

/** Builds the full type string map once: 'n8n-nodes-base.webhook' -> schema. */
const SCHEMA_BY_TYPE = new Map(
  Object.entries(SCHEMAS).map(([suffix, schema]) => ['n8n-nodes-base.' + suffix, schema])
);

/**
 * Validates one node's parameters against the curated schema for its type.
 * Returns an array of warning strings (empty when the node is fine or its
 * type has no schema). `name` is the display name used in messages.
 */
export function validateNodeParams(node, t) {
  const schema = SCHEMA_BY_TYPE.get(node?.type);
  if (!schema) return [];
  const warnings = [];
  const name = node.name || node.id || node.type;
  const params = (node.parameters && typeof node.parameters === 'object' && !Array.isArray(node.parameters)) ? node.parameters : {};

  for (const req of schema.required || []) {
    const v = params[req];
    if (v === undefined || v === null || v === '') {
      warnings.push(t('warnParamMissing', { name, param: req }));
    }
  }

  if (schema.requiredAny && !schema.requiredAny.some((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')) {
    warnings.push(t('warnParamMissing', { name, param: schema.requiredAny.join(' / ') }));
  }

  if (schema.strict) {
    const known = new Set(schema.known || []);
    for (const key of Object.keys(params)) {
      if (!known.has(key)) {
        warnings.push(t('warnParamUnknown', { name, param: key }));
      }
    }
  }

  for (const [param, allowed] of Object.entries(schema.enums || {})) {
    const v = params[param];
    // Only plain strings are checked — expressions ('={{...}}') and complex
    // values are legitimate and must not be flagged.
    if (typeof v === 'string' && v && !v.startsWith('=') && !allowed.includes(v)) {
      warnings.push(t('warnParamEnum', { name, param, value: v, allowed: allowed.join(', ') }));
    }
  }

  if (schema.maxVersion && typeof node.typeVersion === 'number' && node.typeVersion > schema.maxVersion) {
    warnings.push(t('warnTypeVersionHigh', { name, version: node.typeVersion, max: schema.maxVersion }));
  }

  return warnings;
}
