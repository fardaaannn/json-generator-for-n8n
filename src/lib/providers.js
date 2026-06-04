export const PROVIDERS = {
  anthropic: {
    name: 'Anthropic (Claude)',
    url: 'https://api.anthropic.com/v1/messages',
    models: ['claude-sonnet-4-20250514','claude-opus-4-20250514','claude-haiku-4-5-20251001'],
    buildRequest(model, prompt, apiKey) {
      return {
        url: this.url,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? {'x-api-key': apiKey} : {})
        },
        body: JSON.stringify({model, max_tokens: 8000, messages: [{role:'user', content: prompt}]})
      };
    },
    extract(data) { return data.content.map(b => b.text || '').join(''); }
  },
  openai: {
    name: 'OpenAI (GPT)',
    url: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o','gpt-4o-mini','gpt-4-turbo','gpt-3.5-turbo'],
    buildRequest(model, prompt, apiKey) {
      return {
        url: this.url,
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey},
        body: JSON.stringify({model, max_tokens: 8000, messages: [{role:'user', content: prompt}]})
      };
    },
    extract(data) { return data.choices[0].message.content; }
  },
  groq: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: ['llama-3.3-70b-versatile','llama-3.1-8b-instant','mixtral-8x7b-32768'],
    buildRequest(model, prompt, apiKey) {
      return {
        url: this.url,
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey},
        body: JSON.stringify({model, max_tokens: 8000, messages: [{role:'user', content: prompt}]})
      };
    },
    extract(data) { return data.choices[0].message.content; }
  },
  openrouter: {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    models: ['anthropic/claude-sonnet-4-5','openai/gpt-4o','google/gemini-2.0-flash-001','meta-llama/llama-3.3-70b-instruct'],
    buildRequest(model, prompt, apiKey) {
      return {
        url: this.url,
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey},
        body: JSON.stringify({model, max_tokens: 8000, messages: [{role:'user', content: prompt}]})
      };
    },
    extract(data) { return data.choices[0].message.content; }
  },
  custom: {
    name: 'Custom',
    url: '',
    models: [],
    buildRequest(model, prompt, apiKey, baseUrl) {
      const cleanBase = (baseUrl || '').replace(/\/+$/, '');
      const url = cleanBase + '/chat/completions';
      return {
        url,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? {'Authorization': 'Bearer ' + apiKey} : {})
        },
        body: JSON.stringify({model, max_tokens: 8000, messages: [{role:'user', content: prompt}]})
      };
    },
    extract(data) {
      return data.choices?.[0]?.message?.content
        || data.content?.[0]?.text
        || JSON.stringify(data);
    }
  }
};
