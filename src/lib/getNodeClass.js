// Classify a node type for preview styling. Matching happens on the SHORT
// type name (the part after the last dot): naive substring matching on the
// full type misclassified e.g. 'spotify'/'shopify' as logic nodes because they
// contain "if". Logic names are matched exactly (plus the split* family);
// trigger-ish words can safely stay substring matches on the short name.
export function getNodeClass(type) {
  if (!type) return 'action';
  const t = String(type).toLowerCase();
  const short = t.slice(t.lastIndexOf('.') + 1);
  if (/trigger|webhook|cron|schedule/.test(short)) return 'trigger';
  if (/^(if|switch|merge)$/.test(short) || short.startsWith('split')) return 'logic';
  return 'action';
}
