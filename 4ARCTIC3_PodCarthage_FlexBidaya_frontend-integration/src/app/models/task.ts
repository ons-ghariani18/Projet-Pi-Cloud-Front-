export interface Task {
  id?: number;
  title: string;
  description?: string;
  status: 'TODO' | 'DOING' | 'DONE';
  createdBy?: string;
}
