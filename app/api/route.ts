import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not set")
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      )
    }

    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      )
    }

    // Get the model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" })

    // Convert messages to Gemini format
    const formattedMessages = messages.map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }))

    // Start a chat
    const chat = model.startChat({
      history: formattedMessages.slice(0, -1), // All messages except the last one
    })

    // Send the last message and get response
    const result = await chat.sendMessage(messages[messages.length - 1].content)
    const response = await result.response

    return NextResponse.json({ response: response.text() })
  } catch (error) {
    console.error("Error in chat route:", error)
    
    // Provide more specific error messages based on the error type
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: "Invalid API key or API key error" },
          { status: 401 }
        )
      }
      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: "Failed to process chat request", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
} 