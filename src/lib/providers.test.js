import { describe, it, expect } from 'vitest'
import { PROVIDERS, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE, isOpenAIReasoningModel } from './providers.js'

// Request-shape tests: these bodies are the app's actual contract with each
// provider, and the OpenAI reasoning-model branch in particular is the kind of
// thing that regresses silently (a wrong param name = 400 at runtime only).

const SYSTEM = 'You output JSON.'
const PROMPT = 'make a workflow'
const KEY = 'test-key'

function body(req) {
  return JSON.parse(req.body)
}

describe('isOpenAIReasoningModel', () => {
  it('detects o-series and gpt-5 models', () => {
    expect(isOpenAIReasoningModel('o1')).toBe(true)
    expect(isOpenAIReasoningModel('o3-mini')).toBe(true)
    expect(isOpenAIReasoningModel('o4-mini')).toBe(true)
    expect(isOpenAIReasoningModel('gpt-5')).toBe(true)
    expect(isOpenAIReasoningModel('gpt-5-mini')).toBe(true)
  })

  it('does not flag classic chat models', () => {
    expect(isOpenAIReasoningModel('gpt-4o')).toBe(false)
    expect(isOpenAIReasoningModel('gpt-4o-mini')).toBe(false)
    expect(isOpenAIReasoningModel('gpt-3.5-turbo')).toBe(false)
    expect(isOpenAIReasoningModel(null)).toBe(false)
  })
})

describe('openai buildRequest', () => {
  it('uses max_tokens + temperature for classic models', () => {
    const req = PROVIDERS.openai.buildRequest('gpt-4o', PROMPT, KEY, undefined, SYSTEM, 8000, {})
    const b = body(req)
    expect(b.max_tokens).toBe(8000)
    expect(b.temperature).toBe(DEFAULT_TEMPERATURE)
    expect(b.max_completion_tokens).toBeUndefined()
    expect(b.response_format).toEqual({ type: 'json_object' })
    expect(b.messages[0]).toEqual({ role: 'system', content: SYSTEM })
    expect(req.headers.Authorization).toBe('Bearer ' + KEY)
  })

  it('uses max_completion_tokens and omits temperature for reasoning models', () => {
    const req = PROVIDERS.openai.buildRequest('o3-mini', PROMPT, KEY, undefined, SYSTEM, 8000, {})
    const b = body(req)
    expect(b.max_completion_tokens).toBe(8000)
    expect(b.max_tokens).toBeUndefined()
    expect(b.temperature).toBeUndefined()
  })

  it('drops response_format when disabled and adds stream when asked', () => {
    const req = PROVIDERS.openai.buildRequest('gpt-4o', PROMPT, KEY, undefined, SYSTEM, 8000, { responseFormat: false, stream: true })
    const b = body(req)
    expect(b.response_format).toBeUndefined()
    expect(b.stream).toBe(true)
  })
})

describe('anthropic buildRequest', () => {
  it('builds a Messages API body with system as a top-level param', () => {
    const req = PROVIDERS.anthropic.buildRequest('claude-sonnet-4-20250514', PROMPT, KEY, undefined, SYSTEM, 4000, {})
    const b = body(req)
    expect(b.max_tokens).toBe(4000)
    expect(b.system).toBe(SYSTEM)
    expect(b.messages).toEqual([{ role: 'user', content: PROMPT }])
    expect(req.headers['x-api-key']).toBe(KEY)
    expect(req.url).toBe('https://api.anthropic.com/v1/messages')
  })
})

describe('custom buildRequest', () => {
  it('joins the base URL and /chat/completions without double slashes', () => {
    const req = PROVIDERS.custom.buildRequest('my-model', PROMPT, KEY, 'http://localhost:1234/v1/', SYSTEM, undefined, {})
    expect(req.url).toBe('http://localhost:1234/v1/chat/completions')
    expect(body(req).max_tokens).toBe(DEFAULT_MAX_TOKENS)
  })
})
