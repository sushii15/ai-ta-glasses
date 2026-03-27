import type { Express, Request, Response } from "express";
import type { Server } from "http";
import multer from "multer";
import { GoogleGenerativeAI, Part } from "@google/generative-ai";

// Parse PDF using pdfjs-dist — pure JS, works on all platforms
async function parsePdf(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs") as any;
  // Resolve worker path using require (works in both ESM and CJS bundles)
  const { resolve, dirname } = await import("path");
  const { fileURLToPath } = await import("url");
  // __filename shim for CJS; import.meta.url for ESM
  let baseDir: string;
  try {
    // ESM context
    baseDir = dirname(fileURLToPath(import.meta.url));
  } catch {
    // CJS context — __dirname is available globally
    baseDir = (globalThis as any).__dirname ?? process.cwd();
  }
  // Walk up to find node_modules
  const workerPath = resolve(baseDir, "../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file:///${workerPath.replace(/\\/g, "/")}`;

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as any[])
      .map((item: any) => item.str)
      .join(" ");
    fullText += pageText + "\n";
  }

  return fullText.trim();
}
import { storage } from "./storage";

// ── Gemini setup ──────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyC38btKI9i_hZfD9VsmVONorbuZ-d173Bs";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// gemini-2.5-flash — latest, fastest, multimodal, highest rate limits
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ── File upload (in-memory, no disk) ─────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
});

// ── In-memory lab manual store ────────────────────────────────────────────────
// Stores the extracted text from the uploaded PDF per session
let labManualText: string = "";
let labManualName: string = "";

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(manualText: string): string {
  return `You are an AI Teaching Assistant for electronics engineering labs. You help students debug circuits, understand components, and follow lab procedures.

${manualText ? `--- LAB MANUAL ---\n${manualText}\n--- END LAB MANUAL ---\n` : "No lab manual uploaded yet."}

Your role:
- Analyze circuit images the student shares with you
- Cross-reference what you see with the lab manual (if uploaded)
- Identify errors, misplaced components, wrong connections
- Brainstorm possible causes and fixes with the student
- Be encouraging, precise, and educational
- When you see a circuit image, describe what you observe, then check it against the lab manual steps
- Point out specific issues: wrong component value, reversed polarity, missing connections, short circuits, etc.

Keep responses concise but thorough. Use bullet points for lists of issues. If you're unsure, say so and suggest what to check.`;
}

// ── Routes ────────────────────────────────────────────────────────────────────
export function registerRoutes(httpServer: Server, app: Express) {

  // POST /api/upload-manual — upload and parse lab manual PDF
  app.post("/api/upload-manual", upload.single("manual"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { mimetype, originalname, buffer } = req.file;

      if (mimetype === "application/pdf") {
        labManualText = await parsePdf(buffer);
        labManualName = originalname;
      } else if (mimetype === "text/plain") {
        labManualText = buffer.toString("utf-8");
        labManualName = originalname;
      } else {
        return res.status(400).json({ error: "Only PDF or TXT files are supported" });
      }

      // Clear previous chat when new manual is uploaded
      await storage.clearMessages();

      console.log(`[Manual] Loaded: ${labManualName} (${labManualText.length} chars)`);

      res.json({
        success: true,
        name: labManualName,
        charCount: labManualText.length,
        preview: labManualText.slice(0, 200),
      });
    } catch (err) {
      console.error("[upload-manual error]", err);
      res.status(500).json({ error: "Failed to parse manual" });
    }
  });

  // GET /api/manual-status — check if a manual is loaded
  app.get("/api/manual-status", (_req, res) => {
    res.json({
      loaded: !!labManualText,
      name: labManualName,
      charCount: labManualText.length,
    });
  });

  // DELETE /api/manual — clear the manual
  app.delete("/api/manual", async (_req, res) => {
    labManualText = "";
    labManualName = "";
    await storage.clearMessages();
    res.json({ success: true });
  });

  // GET /api/messages — fetch chat history
  app.get("/api/messages", async (_req, res) => {
    const messages = await storage.getMessages();
    res.json(messages);
  });

  // DELETE /api/messages — clear chat
  app.delete("/api/messages", async (_req, res) => {
    await storage.clearMessages();
    res.json({ success: true });
  });

  // POST /api/chat — main chat endpoint
  // Accepts: { content: string, imageBase64?: string (jpeg/png base64), imageMime?: string }
  app.post("/api/chat", async (req: Request, res: Response) => {
    const { content, imageBase64, imageMime } = req.body;

    if (!content?.trim() && !imageBase64) {
      return res.status(400).json({ error: "Message or image required" });
    }

    // Save user message
    const userMsg = await storage.addMessage({
      role: "user",
      content: content || "(sent a circuit image for analysis)",
      timestamp: new Date().toISOString(),
    });

    try {
      // Build conversation history for context
      const history = await storage.getMessages();
      // Last 10 messages for context window management
      const recentHistory = history.slice(-10);

      // Build the Gemini prompt parts
      const parts: Part[] = [];

      // System context as first part
      parts.push({ text: buildSystemPrompt(labManualText) });

      // Add conversation history
      for (const msg of recentHistory) {
        if (msg.id === userMsg.id) continue; // skip the current user message
        parts.push({ text: `${msg.role === "user" ? "Student" : "AI TA"}: ${msg.content}` });
      }

      // Add the current user message
      parts.push({ text: `Student: ${content || "Please analyze my circuit."}` });

      // Add camera image if provided
      if (imageBase64 && imageMime) {
        parts.push({
          inlineData: {
            mimeType: imageMime as "image/jpeg" | "image/png",
            data: imageBase64,
          },
        });
        parts.push({ text: "The image above is a live photo of the student's circuit. Please analyze it carefully." });
      }

      parts.push({ text: "AI TA:" });

      // Call Gemini
      const result = await model.generateContent(parts);
      const aiText = result.response.text();

      // Save AI response
      const aiMsg = await storage.addMessage({
        role: "assistant",
        content: aiText,
        timestamp: new Date().toISOString(),
      });

      res.json({ userMessage: userMsg, aiMessage: aiMsg });

    } catch (err: unknown) {
      console.error("[chat error]", err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";

      // Friendly fallback when quota exceeded or API unavailable
      let fallbackContent: string;
      if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("rate")) {
        fallbackContent = `⚠️ API quota exceeded for now. Here's what I'd check based on your question:\n\n${getFallbackResponse(content)}\n\n_(Live AI analysis will resume once the quota resets — typically within a minute.)_`;
      } else if (errMsg.includes("404") || errMsg.includes("not found")) {
        fallbackContent = `⚠️ AI model temporarily unavailable. Checking your issue manually:\n\n${getFallbackResponse(content)}`;
      } else {
        fallbackContent = `⚠️ Connection error. While that resolves:\n\n${getFallbackResponse(content)}`;
      }

      const aiMsg = await storage.addMessage({
        role: "assistant",
        content: fallbackContent,
        timestamp: new Date().toISOString(),
      });

      res.json({ userMessage: userMsg, aiMessage: aiMsg, error: errMsg });
    }
  });
}

// ── Fallback responses when Gemini is unavailable ─────────────────────────────
function getFallbackResponse(prompt: string): string {
  const p = (prompt || "").toLowerCase();
  if (p.includes("led") && (p.includes("not") || p.includes("light") || p.includes("dim"))) {
    return `**LED not lighting up — top causes:**
1. **Reversed polarity** — LED's long leg (anode) must connect toward VCC, short leg (cathode) toward GND
2. **Missing or wrong resistor** — without a current-limiting resistor the LED may have burned out instantly
3. **Loose connections** — re-seat every jumper wire firmly
4. **Wrong resistor value** — for 5V use min 150Ω (formula: R = (Vcc − Vf) / If = (5−2)/0.02)
5. **Dead LED** — test with a multimeter in diode mode`;
  }
  if (p.includes("resistor")) {
    return `**Resistor checks:**
- Read color bands: Brown-Black-Red = 1kΩ, Brown-Black-Orange = 10kΩ
- Check orientation (resistors are not polarized, either way is fine)
- Verify it's in series with the load, not across the power rails
- Measure with multimeter on Ω setting to confirm the value`;
  }
  if (p.includes("short") || p.includes("wrong") || p.includes("error") || p.includes("broken")) {
    return `**Common circuit errors to check:**
1. Two rails directly bridged — always put a component between VCC and GND
2. Component in wrong breadboard row (rows aren't connected across the center gap)
3. IC/LED reversed — check datasheet for correct orientation
4. Power supply not connected or wrong voltage
5. Multimeter test: measure VCC-to-GND with power on — should read your supply voltage`;
  }
  if (p.includes("breadboard")) {
    return `**Breadboard layout reminders:**
- Outer long rails: horizontal connections (power buses)
- Inner short rows: vertical groups of 5 (both sides separate at center gap)
- DIP ICs span the center gap so each pin is on an isolated row
- Jumpers must be fully pushed in — half-seated wires are the #1 debugging headache`;
  }
  return `**General debug checklist:**
1. Verify power: VCC rail to + terminal, GND to − terminal
2. Check every connection is fully seated
3. Confirm component orientations (LEDs, capacitors, ICs are polarized)
4. Measure voltages with a multimeter at each stage
5. Compare your layout against the lab manual step by step`;
}
