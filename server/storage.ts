import {
  chatMessages,
  labSessions,
  detectionEvents,
  type ChatMessage,
  type InsertChatMessage,
  type LabSession,
  type InsertLabSession,
  type DetectionEvent,
  type InsertDetectionEvent,
} from "@shared/schema";

export interface IStorage {
  // Chat
  getMessages(): Promise<ChatMessage[]>;
  addMessage(msg: InsertChatMessage): Promise<ChatMessage>;
  clearMessages(): Promise<void>;

  // Lab sessions
  getLabSession(id: number): Promise<LabSession | undefined>;
  createLabSession(session: InsertLabSession): Promise<LabSession>;
  updateLabSession(id: number, data: Partial<LabSession>): Promise<LabSession | undefined>;

  // Detection events
  addDetectionEvent(event: InsertDetectionEvent): Promise<DetectionEvent>;
  getRecentDetections(limit?: number): Promise<DetectionEvent[]>;
}

export class MemStorage implements IStorage {
  private messages: Map<number, ChatMessage> = new Map();
  private sessions: Map<number, LabSession> = new Map();
  private detections: Map<number, DetectionEvent> = new Map();
  private msgCounter = 0;
  private sessionCounter = 0;
  private detectionCounter = 0;

  async getMessages(): Promise<ChatMessage[]> {
    return Array.from(this.messages.values()).sort((a, b) => a.id - b.id);
  }

  async addMessage(msg: InsertChatMessage): Promise<ChatMessage> {
    this.msgCounter++;
    const record: ChatMessage = { id: this.msgCounter, ...msg };
    this.messages.set(this.msgCounter, record);
    return record;
  }

  async clearMessages(): Promise<void> {
    this.messages.clear();
  }

  async getLabSession(id: number): Promise<LabSession | undefined> {
    return this.sessions.get(id);
  }

  async createLabSession(session: InsertLabSession): Promise<LabSession> {
    this.sessionCounter++;
    const record: LabSession = {
      id: this.sessionCounter,
      labName: session.labName,
      currentStep: session.currentStep ?? 0,
      completed: session.completed ?? false,
    };
    this.sessions.set(this.sessionCounter, record);
    return record;
  }

  async updateLabSession(id: number, data: Partial<LabSession>): Promise<LabSession | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    const updated = { ...session, ...data };
    this.sessions.set(id, updated);
    return updated;
  }

  async addDetectionEvent(event: InsertDetectionEvent): Promise<DetectionEvent> {
    this.detectionCounter++;
    const record: DetectionEvent = { id: this.detectionCounter, ...event };
    this.detections.set(this.detectionCounter, record);
    return record;
  }

  async getRecentDetections(limit = 20): Promise<DetectionEvent[]> {
    return Array.from(this.detections.values())
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
