import { FeedbackQuestion } from "./feedback-question";

export interface FeedbackForm {
  id?: number;
  title: string;
  description?: string;
  targetType: 'EVENT' | 'HACKATHON';
  targetId: number;
  active?: boolean;
  questions: FeedbackQuestion[];
}