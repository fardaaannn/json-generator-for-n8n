/**
 * Curated catalog of common built-in n8n node types (the `n8n-nodes-base.*`
 * namespace). Used only to flag likely-hallucinated or mistyped node types as a
 * NON-BLOCKING warning — it is intentionally not exhaustive. We only check the
 * `n8n-nodes-base.` namespace (the one most prone to being invented); nodes from
 * other namespaces (e.g. `@n8n/n8n-nodes-langchain.*`, community nodes) are not
 * checked to avoid false positives.
 */

// Stored without the `n8n-nodes-base.` prefix.
const BASE_NODE_NAMES = new Set([
  // core / triggers
  'start', 'manualTrigger', 'scheduleTrigger', 'cron', 'interval', 'webhook',
  'respondToWebhook', 'errorTrigger', 'executeWorkflow', 'executeWorkflowTrigger',
  'n8nTrigger', 'workflowTrigger', 'formTrigger', 'sseTrigger', 'localFileTrigger',
  'emailReadImap', 'rssFeedReadTrigger',
  // flow / data
  'set', 'code', 'function', 'functionItem', 'noOp', 'if', 'switch', 'merge',
  'splitInBatches', 'splitOut', 'aggregate', 'filter', 'itemLists', 'sort',
  'limit', 'removeDuplicates', 'renameKeys', 'dateTime', 'wait', 'stopAndError',
  'compareDatasets', 'summarize', 'markdown',
  // files / formats
  'html', 'htmlExtract', 'xml', 'crypto', 'compression', 'editImage',
  'spreadsheetFile', 'readWriteFile', 'readBinaryFile', 'writeBinaryFile',
  'readBinaryFiles', 'moveBinaryData', 'readPdf', 'convertToFile', 'extractFromFile',
  // network / generic
  'httpRequest', 'graphql', 'ftp', 'ssh', 'executeCommand', 'rssFeedRead',
  'emailSend', 'sendEmail',
  // google
  'googleSheets', 'googleSheetsTrigger', 'googleDrive', 'googleDriveTrigger',
  'googleCalendar', 'googleDocs', 'gmail', 'gmailTrigger', 'googleCloudStorage',
  'googleTranslate', 'googleBigQuery',
  // microsoft
  'microsoftExcel', 'microsoftOutlook', 'microsoftTeams', 'microsoftOneDrive',
  'microsoftSql',
  // messaging
  'slack', 'slackTrigger', 'discord', 'telegram', 'telegramTrigger', 'whatsApp',
  'mattermost', 'twilio', 'pushover',
  // productivity / crm
  'notion', 'notionTrigger', 'airtable', 'airtableTrigger', 'baserow', 'nocoDb',
  'trello', 'trelloTrigger', 'asana', 'clickUp', 'mondayCom', 'todoist', 'jira',
  'jiraTrigger', 'hubspot', 'hubspotTrigger', 'salesforce', 'pipedrive', 'zendesk',
  'calendly', 'typeform', 'typeformTrigger',
  // databases
  'mySql', 'postgres', 'mongoDb', 'redis', 'supabase', 'snowflake', 'questDb',
  'elasticsearch',
  // marketing / payments / ecommerce
  'mailchimp', 'sendGrid', 'mailgun', 'mailjet', 'stripe', 'stripeTrigger',
  'paypal', 'shopify', 'shopifyTrigger', 'wooCommerce', 'wooCommerceTrigger',
  // dev / cloud
  'github', 'githubTrigger', 'gitlab', 'awsS3', 'awsLambda', 'awsSes', 'awsSns',
  'dropbox', 'box', 'wordpress', 'ghost', 'openAi',
  // social / media
  'twitter', 'linkedIn', 'facebookGraphApi', 'reddit', 'youTube', 'spotify',
  // misc
  'openWeatherMap', 'coinGecko', 'wise', 'webflow', 'strapi',
])

/**
 * @param {string} type e.g. "n8n-nodes-base.httpRequest"
 * @returns {boolean} true only when we are confident the type is unknown
 *   (i.e. it is in the base namespace but not in our catalog). Returns false
 *   for any other namespace so we never warn about nodes we can't verify.
 */
export function isLikelyUnknownNodeType(type) {
  if (typeof type !== 'string') return false
  const prefix = 'n8n-nodes-base.'
  if (!type.startsWith(prefix)) return false
  const name = type.slice(prefix.length)
  if (!name) return false
  return !BASE_NODE_NAMES.has(name)
}

export { BASE_NODE_NAMES }
