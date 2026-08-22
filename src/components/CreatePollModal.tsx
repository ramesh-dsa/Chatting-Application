import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { PollData, PollOption } from '../types';
import { stripHTML } from '../utils/sanitize';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePoll: (pollData: PollData) => void;
}

export default function CreatePollModal({ isOpen, onClose, onCreatePoll }: CreatePollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multipleAnswers, setMultipleAnswers] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    setError('');
  };

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }
    
    const cleanQuestion = stripHTML(question.trim());
    if (cleanQuestion.length > 200) {
      setError('Question is too long (max 200 characters)');
      return;
    }

    const validOptions = options.map(opt => stripHTML(opt.trim())).filter(opt => opt.length > 0);
    
    if (validOptions.some(opt => opt.length > 100)) {
      setError('One or more options are too long (max 100 characters)');
      return;
    }
    
    if (validOptions.length < 2) {
      setError('Please provide at least 2 options');
      return;
    }
    
    // Check for duplicates
    const uniqueOptions = new Set(validOptions.map(opt => opt.trim().toLowerCase()));
    if (uniqueOptions.size !== validOptions.length) {
      setError('Options must be unique');
      return;
    }

    const pollOptions: PollOption[] = validOptions.map((text, index) => ({
      id: `opt-${Date.now()}-${index}`,
      text: text,
      voters: []
    }));

    onCreatePoll({
      question: cleanQuestion,
      options: pollOptions,
      multipleAnswers
    });

    // Reset state
    setQuestion('');
    setOptions(['', '']);
    setMultipleAnswers(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Create Poll</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-hover text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-xl border border-destructive/20">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Question
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => { setQuestion(e.target.value); setError(''); }}
                placeholder="Ask a question"
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Options
              </label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {options.length < 10 && (
                <button
                  type="button"
                  onClick={addOption}
                  className="mt-3 flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Option
                </button>
              )}
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={multipleAnswers}
                    onChange={(e) => setMultipleAnswers(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-surface-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent border border-border"></div>
                </div>
                <span className="text-sm font-medium text-foreground">
                  Allow multiple answers
                </span>
              </label>
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-border bg-surface rounded-b-2xl">
          <button
            onClick={handleSubmit}
            className="w-full py-2.5 bg-accent hover:bg-accent-hover text-accent-foreground font-medium rounded-xl transition-colors shadow-sm active:scale-[0.98]"
          >
            Send Poll
          </button>
        </div>
      </div>
    </div>
  );
}
