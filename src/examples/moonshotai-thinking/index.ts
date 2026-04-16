import { createMoonshotAI, type MoonshotAILanguageModelOptions } from "@ai-sdk/moonshotai"
import { type CoreMessage, ToolLoopAgent, tool, jsonSchema } from "ai"
import { run } from "../../lib/run.ts"

const moonshotai = createMoonshotAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.MOONSHOT_API_BASE_URL || "https://deepseek.api.modular.com/v1",
})

const agent = new ToolLoopAgent({
  model: moonshotai("moonshotai/kimi-k2.5"),
  tools: {
    greetings: tool({
      description: "Greet a person by name",
      inputSchema: jsonSchema<{ name: string }>({
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the person to greet",
          },
        },
        required: ["name"],
      }),
      execute: async ({ name }) => `${name}, greetings!`,
    }),
  },
  providerOptions: {
    moonshotai: {
      thinking: {
        type: "enabled",
        budgetTokens: 2048,
      },
      reasoningHistory: "interleaved",
    } satisfies MoonshotAILanguageModelOptions,
  },
})

const userPrompt = process.argv[2] ?? 'How many "r"s are in the word "strawberry"?'

run(async () => {
  const messages: CoreMessage[] = []

  for (let round = 1; round <= 3; round++) {
    console.log(`=== Round ${round} ===`)
    console.log()

    messages.push({ role: "user", content: userPrompt })

    const result = await agent.stream({ messages })

    // kimi-k2.5 sometimes emits reasoning as <think>...</think> inside
    // text content instead of proper reasoning events, especially on
    // multi-step calls. Tags can span across steps, so we accumulate
    // all text and strip think blocks at the end.
    let allText = ""

    for await (const part of result.fullStream) {
      switch (part.type) {
        case "reasoning-start":
          process.stdout.write("Reasoning: ")
          break
        case "reasoning-delta":
          process.stdout.write(part.text)
          break
        case "reasoning-end":
          console.log("\n\n---\n")
          break
        case "text-delta":
          allText += part.text
          break
        case "tool-call":
          console.log(`[tool] ${part.toolName}(${JSON.stringify(part.input)})`)
          break
        case "tool-result":
          console.log(`[tool] => ${JSON.stringify(part.output)}`)
          break
      }
    }

    // Strip <think>...</think> blocks and bare </think> with preceding
    // leaked reasoning. The provider consumes opening <think> as
    // reasoning events but the closing tag leaks into later text steps.
    if (/<think>|<\/think>/.test(allText)) {
      console.warn("⚠️  Warning: leaked <think> tag detected in text output")
    }

    const output = allText
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .replace(/[\s\S]*?<\/think>/g, "")
      .trim()
    if (output) console.log("Output:", output)

    console.log()
    console.log("Token usage:", await result.usage)
    console.log("Finish reason:", await result.finishReason)
    console.log()

    messages.push(...(await result.response).messages)
  }
})
