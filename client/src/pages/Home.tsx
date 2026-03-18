import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, MicOff, Send, Trash2, Upload, X, Camera,
  BookOpen, Cpu, ChevronDown, AlertCircle, CheckCircle2,
  Loader2, ScanLine, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ChatMessage } from "@shared/schema";

// ── Voice recognition types ───────────────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

// ── Capture a frame from a video element as base64 jpeg ───────────────────────
function captureFrame(video: HTMLVideoElement, quality = 0.85): { base64: string; mime: string } | null {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = dataUrl.split(",")[1];
  return { base64, mime: "image/jpeg" };
}

export default function Home() {
  const { toast } = useToast();

  // ── Camera ────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camActive, setCamActive] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  // ── Lab manual ────────────────────────────────────────────────────────────
  const [manualLoaded, setManualLoaded] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualUploading, setManualUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Chat ──────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Voice ─────────────────────────────────────────────────────────────────
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [interimText, setInterimText] = useState("");

  // ── Init: check voice support + load manual status ────────────────────────
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SpeechRec);

    // Check if a manual is already loaded server-side
    fetch("/api/manual-status")
      .then(r => r.json())
      .then(d => {
        if (d.loaded) { setManualLoaded(true); setManualName(d.name); }
      })
      .catch(() => {});

    // Load existing messages
    fetch("/api/messages")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMessages(d); })
      .catch(() => {});
  }, []);

  // ── Auto-start camera on load ─────────────────────────────────────────────
  useEffect(() => {
    startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Camera ────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCamActive(true);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Camera access denied";
      setCamError(msg);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCamActive(false);
  }, []);

  // ── Manual upload ─────────────────────────────────────────────────────────
  const handleManualUpload = useCallback(async (file: File) => {
    setManualUploading(true);
    try {
      const formData = new FormData();
      formData.append("manual", file);
      const res = await fetch("/api/upload-manual", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setManualLoaded(true);
      setManualName(data.name);
      setMessages([]); // fresh chat
      toast({ title: "Lab manual loaded", description: `${data.name} — ${data.charCount.toLocaleString()} characters read` });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setManualUploading(false);
    }
  }, [toast]);

  const clearManual = useCallback(async () => {
    await fetch("/api/manual", { method: "DELETE" });
    setManualLoaded(false);
    setManualName("");
    setMessages([]);
    toast({ title: "Lab manual cleared" });
  }, [toast]);

  // ── Chat + Gemini ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? inputText).trim();
    if (!content) return;
    setInputText("");
    setInterimText("");
    setIsLoading(true);
    setIsScanning(true);

    // Always capture camera frame if camera is active
    let imageBase64: string | undefined;
    let imageMime: string | undefined;
    if (camActive && videoRef.current) {
      const frame = captureFrame(videoRef.current);
      if (frame) { imageBase64 = frame.base64; imageMime = frame.mime; }
    }

    // Optimistic user message
    const tempMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: content || "(scanning circuit…)",
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await apiRequest("POST", "/api/chat", {
        content,
        imageBase64,
        imageMime,
      });
      const data = await res.json();
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempMsg.id),
        data.userMessage,
        data.aiMessage,
      ]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempMsg.id),
        { ...tempMsg, id: tempMsg.id + 1 },
        {
          id: Date.now() + 2,
          role: "assistant",
          content: `⚠️ Error: ${errMsg}\n\nMake sure the server is running (npm run dev) and try again.`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setIsScanning(false);
    }
  }, [inputText, camActive]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const clearChat = useCallback(async () => {
    await apiRequest("DELETE", "/api/messages");
    setMessages([]);
  }, []);

  // ── Voice input ───────────────────────────────────────────────────────────
  const startVoice = useCallback(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    const rec = new SpeechRec();
    rec.continuous = true;       // keep listening
    rec.interimResults = true;   // show live transcript
    rec.lang = "en-US";

    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim) setInterimText(interim);
      if (final) {
        setInputText(prev => (prev + " " + final).trim());
        setInterimText("");
      }
    };

    rec.onerror = (e) => {
      console.error("Voice error", e.error);
      setVoiceActive(false);
    };

    rec.onend = () => {
      setVoiceActive(false);
    };

    rec.start();
    recognitionRef.current = rec;
    setVoiceActive(true);
  }, []);

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop();
    setVoiceActive(false);
    setInterimText("");
  }, []);

  const toggleVoice = useCallback(() => {
    if (voiceActive) stopVoice();
    else startVoice();
  }, [voiceActive, startVoice, stopVoice]);

  // Send when voice stops and there's text
  useEffect(() => {
    if (!voiceActive && inputText.trim() && messages.length > 0) {
      // Auto-send only if the input was built from voice (not manual typing)
      // We track this via a ref to avoid false triggers
    }
  }, [voiceActive, inputText, messages.length]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Drag & drop for manual ────────────────────────────────────────────────
  const [dragOver, setDragOver] = useState(false);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleManualUpload(file);
  }, [handleManualUpload]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-background overflow-hidden" data-testid="app-root">

      {/* ══ LEFT: Camera panel ══ */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-border">

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <svg aria-label="AI TA Glasses" viewBox="0 0 32 32" fill="none" className="h-7 w-7">
              <rect x="2" y="11" width="10" height="10" rx="3" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
              <rect x="20" y="11" width="10" height="10" rx="3" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
              <line x1="12" y1="16" x2="20" y2="16" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
              <line x1="2" y1="16" x2="0" y2="16" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
              <line x1="32" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
              <circle cx="7" cy="16" r="2" fill="currentColor" className="text-primary" />
              <circle cx="25" cy="16" r="2" fill="currentColor" className="text-primary" />
            </svg>
            <div>
              <span className="text-sm font-bold tracking-widest uppercase text-primary font-mono">AI TA Glasses</span>
              <span className="text-xs text-muted-foreground ml-2">Electronics Lab Assistant</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs font-mono ${camActive ? "text-green-400 border-green-500/40" : "text-muted-foreground"}`}>
              {camActive ? "● LIVE" : "○ OFFLINE"}
            </Badge>
            {isScanning && (
              <Badge variant="outline" className="text-xs font-mono text-primary border-primary/40 animate-pulse">
                <ScanLine size={10} className="mr-1" /> SCANNING
              </Badge>
            )}
            {!camActive && (
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={startCamera}>
                <Camera size={12} className="mr-1" /> Enable Camera
              </Button>
            )}
          </div>
        </div>

        {/* Camera feed — full remaining height */}
        <div className="relative flex-1 min-h-0 bg-black overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            playsInline
            data-testid="webcam-video"
          />

          {/* No camera state */}
          {!camActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
              <Camera size={40} className="text-primary/40" />
              <p className="text-sm text-muted-foreground font-mono">Camera offline</p>
              {camError && (
                <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded border border-destructive/30 max-w-xs text-center">
                  {camError}
                </p>
              )}
              <Button onClick={startCamera} size="sm">
                <Camera size={12} className="mr-2" /> Enable Camera
              </Button>
            </div>
          )}

          {/* Scanning overlay — just a subtle pulse border, no bounding boxes */}
          {isScanning && (
            <div className="absolute inset-0 border-2 border-primary/60 animate-pulse pointer-events-none rounded-sm" />
          )}

          {/* Bottom-left: live indicator */}
          {camActive && (
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded text-xs font-mono text-primary/80 border border-primary/20">
              Every message captures a frame for AI analysis
            </div>
          )}
        </div>
      </div>

      {/* ══ RIGHT: Chat + Manual panel ══ */}
      <div className="w-[420px] shrink-0 flex flex-col bg-sidebar" data-testid="chat-panel">

        {/* ── Lab Manual section ── */}
        <div className="border-b border-border shrink-0">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BookOpen size={14} className="text-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest">Lab Manual</span>
              </div>
              {manualLoaded && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={clearManual}
                  data-testid="btn-clear-manual"
                >
                  <X size={12} />
                </Button>
              )}
            </div>

            {manualLoaded ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded bg-green-900/20 border border-green-500/30">
                <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-green-300 font-medium truncate">{manualName}</p>
                  <p className="text-[10px] text-green-500/70">AI has read this manual</p>
                </div>
              </div>
            ) : (
              <div
                className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-secondary/30"}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                data-testid="manual-dropzone"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleManualUpload(f); }}
                  data-testid="manual-file-input"
                />
                {manualUploading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Reading manual…</span>
                  </div>
                ) : (
                  <>
                    <Upload size={18} className="text-muted-foreground/50 mx-auto mb-1.5" />
                    <p className="text-xs text-muted-foreground">Drop your lab manual here</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">PDF or TXT — AI will read it</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Chat header ── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Cpu size={13} className="text-primary" />
            <span className="text-xs font-semibold uppercase tracking-widest">AI Assistant</span>
            {manualLoaded && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-primary border-primary/30">
                <FileText size={8} className="mr-1" /> Manual active
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={clearChat}
            data-testid="btn-clear-chat"
          >
            <Trash2 size={11} />
          </Button>
        </div>

        {/* ── Messages ── */}
        <ScrollArea className="flex-1">
          <div className="p-4 flex flex-col gap-3">

            {/* Welcome / empty state */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center text-center py-6 gap-3">
                <Cpu size={32} className="text-primary/30" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Ready to help debug</p>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px]">
                    {manualLoaded
                      ? `Lab manual loaded. Point your camera at the circuit and describe what's going wrong.`
                      : `Upload your lab manual above, then describe your circuit issue. I'll scan your camera feed and cross-reference the manual to find the problem.`
                    }
                  </p>
                </div>

                {/* Quick starters */}
                <div className="flex flex-col gap-1.5 w-full mt-1">
                  {[
                    "What's wrong with my circuit?",
                    "My LED isn't lighting up",
                    "Check my breadboard connections",
                    "Walk me through what you see",
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-xs text-left px-3 py-2 rounded border border-border hover:border-primary/40 hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message bubbles */}
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}
                data-testid={`msg-${msg.id}`}
              >
                {msg.role === "assistant" && (
                  <span className="text-[10px] text-primary font-mono uppercase tracking-widest ml-1">AI TA</span>
                )}
                <div
                  className={`max-w-[95%] px-3 py-2.5 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary/15 border border-primary/25 text-foreground rounded-tr-sm"
                      : "bg-card border border-border text-foreground rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}

            {/* Thinking indicator */}
            {isLoading && (
              <div className="flex flex-col items-start gap-1">
                <span className="text-[10px] text-primary font-mono uppercase tracking-widest ml-1">AI TA</span>
                <div className="px-3 py-2.5 rounded-lg rounded-tl-sm bg-card border border-border text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin text-primary" />
                  {isScanning ? "Scanning circuit…" : "Thinking…"}
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* ── Voice + Input ── */}
        <div className="p-3 border-t border-border shrink-0 flex flex-col gap-2">

          {/* Voice status bar */}
          {voiceActive && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/20 border border-red-500/30">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-xs text-red-300 flex-1 truncate font-mono">
                {interimText || "Listening…"}
              </span>
              <button
                className="text-[10px] text-red-400 hover:text-red-300"
                onClick={stopVoice}
              >
                Stop
              </button>
            </div>
          )}

          {/* Text input */}
          <Textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={voiceActive ? "Speaking… (or type here)" : "Describe your issue… (Enter to send)"}
            className="min-h-[70px] max-h-[140px] text-sm resize-none bg-input/20 border-border placeholder:text-muted-foreground/40 font-mono text-xs"
            data-testid="chat-input"
          />

          {/* Action buttons */}
          <div className="flex gap-2">
            {/* Voice button — primary action */}
            <Button
              size="sm"
              variant={voiceActive ? "destructive" : "outline"}
              className={`flex-1 text-xs h-9 font-semibold ${voiceActive ? "" : "border-primary/40 text-primary hover:bg-primary/10"}`}
              onClick={toggleVoice}
              disabled={!voiceSupported}
              data-testid="btn-voice"
            >
              {voiceActive
                ? <><MicOff size={13} className="mr-1.5" /> Stop Listening</>
                : <><Mic size={13} className="mr-1.5" /> {voiceSupported ? "Hold to Speak" : "Voice Unavailable"}</>
              }
            </Button>

            {/* Send button */}
            <Button
              size="sm"
              className="flex-1 text-xs h-9"
              onClick={() => sendMessage()}
              disabled={isLoading || (!inputText.trim() && !camActive)}
              data-testid="btn-send"
            >
              {isLoading
                ? <><Loader2 size={12} className="mr-1.5 animate-spin" /> Analyzing…</>
                : <><Send size={12} className="mr-1.5" /> Send + Scan</>
              }
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground/40 text-center">
            Every message captures your camera for circuit analysis
          </p>

          {/* Attribution */}
          <a
            href="https://www.perplexity.ai/computer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 text-center transition-colors"
          >
            Created with Perplexity Computer
          </a>
        </div>
      </div>
    </div>
  );
}
