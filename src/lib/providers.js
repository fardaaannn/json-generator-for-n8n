// Build the messages array, putting the system instruction in its own role
// when provided (better steering than stuffing everything into the user turn).
function buildMessages(prompt, system) {
  return system
    ? [{ role: 'system', content: system }, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }];
}

export const PROVIDERS = {
  anthropic: {
    name: 'Anthropic (Claude)',
    url: 'https://api.anthropic.com/v1/messages',
    models: ['claude-sonnet-4-20250514','claude-opus-4-20250514','claude-haiku-4-5-20251001'],
    buildRequest(model, prompt, apiKey, baseUrl, system) {
      // Anthropic Messages API has no response_format; we use the top-level
      // `system` param to enforce the JSON-only contract.
      return {
        url: this.url,
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          ...(apiKey ? {'x-api-key': apiKey} : {})
        },
        body: JSON.stringify({
          model,
          max_tokens: 8000,
          ...(system ? { system } : {}),
          messages: [{role:'user', content: prompt}]
        })
      };
    },
    extract(data) { return data.content.map(b => b.text || '').join(''); }
  },
  openai: {
    name: 'OpenAI (GPT)',
    url: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o','gpt-4o-mini','gpt-4-turbo','gpt-3.5-turbo'],
    buildRequest(model, prompt, apiKey, baseUrl, system) {
      return {
        url: this.url,
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey},
        body: JSON.stringify({
          model,
          max_tokens: 8000,
          messages: buildMessages(prompt, system),
          response_format: { type: 'json_object' }
        })
      };
    },
    extract(data) { return data.choices[0].message.content; }
  },
  groq: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: ['llama-3.3-70b-versatile','llama-3.1-8b-instant','meta-llama/llama-4-scout-17b-16e-instruct'],
    buildRequest(model, prompt, apiKey, baseUrl, system) {
      return {
        url: this.url,
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey},
        body: JSON.stringify({
          model,
          max_tokens: 8000,
          messages: buildMessages(prompt, system),
          response_format: { type: 'json_object' }
        })
      };
    },
    extract(data) { return data.choices[0].message.content; }
  },
  openrouter: {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    models: ['anthropic/claude-sonnet-4-5','openai/gpt-4o','google/gemini-2.5-flash','meta-llama/llama-3.3-70b-instruct'],
    buildRequest(model, prompt, apiKey, baseUrl, system) {
      return {
        url: this.url,
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey},
        body: JSON.stringify({
          model,
          max_tokens: 8000,
          messages: buildMessages(prompt, system),
          response_format: { type: 'json_object' }
        })
      };
    },
    extract(data) { return data.choices[0].message.content; }
  },
  custom: {
    name: 'Custom',
    url: '',
    models: [],
    buildRequest(model, prompt, apiKey, baseUrl, system) {
      const cleanBase = (baseUrl || '').replace(/\/+$/, '');
      const url = cleanBase + '/chat/completions';
      // No response_format here: a custom OpenAI-compatible endpoint may point
      // at a model/server that rejects it. The system role still improves
      // steering, and the cleaning/repair/validation layers cover the rest.
      return {
        url,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? {'Authorization': 'Bearer ' + apiKey} : {})
        },
        body: JSON.stringify({
          model,
          max_tokens: 8000,
          messages: buildMessages(prompt, system)
        })
      };
    },
    extract(data) {
      return data.choices?.[0]?.message?.content
        || data.content?.[0]?.text
        || JSON.stringify(data);
    }
  }
};
