export function getNodeClass(type) {
  if (!type) return 'action';
  const t = type.toLowerCase();
  if (t.includes('trigger') || t.includes('webhook') || t.includes('cron') || t.includes('schedule')) return 'trigger';
  if (t.includes('if') || t.includes('switch') || t.includes('merge') || t.includes('split')) return 'logic';
  return 'action';
}
