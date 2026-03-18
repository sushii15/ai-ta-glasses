import { pgTable, text, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Chat messages table
export const chatMessages = pgTable("chat_messages", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  timestamp: text("timestamp").notNull(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Lab sessions table
export const labSessions = pgTable("lab_sessions", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  labName: text("lab_name").notNull(),
  currentStep: integer("current_step").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
});

export const insertLabSessionSchema = createInsertSchema(labSessions).omit({ id: true });
export type InsertLabSession = z.infer<typeof insertLabSessionSchema>;
export type LabSession = typeof labSessions.$inferSelect;

// Detection events
export const detectionEvents = pgTable("detection_events", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  componentType: text("component_type").notNull(),
  label: text("label").notNull(),
  confidence: text("confidence").notNull(),
  timestamp: text("timestamp").notNull(),
});

export const insertDetectionEventSchema = createInsertSchema(detectionEvents).omit({ id: true });
export type InsertDetectionEvent = z.infer<typeof insertDetectionEventSchema>;
export type DetectionEvent = typeof detectionEvents.$inferSelect;

// ---- Frontend-only types (not persisted) ----

export interface BoundingBox {
  id: string;
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  w: number; // 0-1 normalized
  h: number; // 0-1 normalized
  label: string;
  confidence: number;
  type: 'resistor' | 'wire' | 'breadboard' | 'led' | 'capacitor' | 'ic' | 'unknown';
  color: string;
  hasError?: boolean;
  errorMessage?: string;
  arrowTarget?: { x: number; y: number };
}

export interface LabStep {
  id: number;
  title: string;
  description: string;
  hint: string;
  components: string[];
  completed: boolean;
  active: boolean;
  errorCheck?: string;
}

export interface DetectedComponent {
  type: string;
  label: string;
  confidence: number;
  position: string;
}
