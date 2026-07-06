
export interface FeedbackQuestion {
  id?: number;
  label: string;
  type: 'LINEAR' | 'TEXT' | 'RADIO' | 'CHECKBOX';
  required: boolean;
  position: number;
  scaleMin?: number;
  scaleMax?: number;
  options?: string; // séparées par "|"
}