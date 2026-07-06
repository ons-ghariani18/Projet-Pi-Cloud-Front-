import { FeedbackAnswer } from "./feedback-answer";

export interface FeedbackResponse {
  form: { id: number };
  participantEmail: string;
  participantName: string;
  answers: FeedbackAnswer[];
}