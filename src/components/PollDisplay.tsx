import { useState, useEffect } from 'react';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Message } from '../types';
import { Check, BarChart2 } from 'lucide-react';

interface PollDisplayProps {
  message: Message;
  conversationId: string;
  currentUserId: string;
}

export default function PollDisplay({ message, conversationId, currentUserId }: PollDisplayProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Optimistic UI state
  const [optimisticPollData, setOptimisticPollData] = useState(message.pollData);

  useEffect(() => {
    setOptimisticPollData(message.pollData);
  }, [message.pollData]);

  const pollData = optimisticPollData || message.pollData;

  if (!pollData) return null;

  // Calculate totals
  const totalVotes = pollData.options.reduce((sum, opt) => sum + opt.voters.length, 0);

  const handleVote = async (optionId: string) => {
    if (pollData.isClosed) return;

    // --- Optimistic UI Update ---
    const localOptions = pollData.options.map(opt => ({
      ...opt,
      voters: [...opt.voters]
    }));
    const localOptionIndex = localOptions.findIndex(o => o.id === optionId);
    if (localOptionIndex !== -1) {
      const hasVotedForThis = localOptions[localOptionIndex].voters.includes(currentUserId);
      if (!pollData.multipleAnswers) {
        localOptions.forEach((opt, idx) => {
          if (idx !== localOptionIndex) {
            opt.voters = opt.voters.filter(uid => uid !== currentUserId);
          }
        });
      }
      if (hasVotedForThis) {
        localOptions[localOptionIndex].voters = localOptions[localOptionIndex].voters.filter(uid => uid !== currentUserId);
      } else {
        localOptions[localOptionIndex].voters.push(currentUserId);
      }
      setOptimisticPollData({ ...pollData, options: localOptions });
    }
    // --- End Optimistic Update ---

    setErrorMsg(null);
    try {
      const messageRef = doc(db, `conversations/${conversationId}/messages`, message.id);
      
      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(messageRef);
        if (!sfDoc.exists()) {
          throw new Error("Message does not exist!");
        }

        const data = sfDoc.data() as Message;
        if (!data.pollData) return;

        // Deep copy to prevent mutating the snapshot
        const updatedOptions = data.pollData.options.map(opt => ({
          ...opt,
          voters: [...opt.voters]
        }));
        const optionIndex = updatedOptions.findIndex(o => o.id === optionId);
        
        if (optionIndex === -1) return;

        const hasVotedForThis = updatedOptions[optionIndex].voters.includes(currentUserId);

        // If not multiple answers, remove user's vote from all other options
        if (!data.pollData.multipleAnswers) {
          updatedOptions.forEach((opt, idx) => {
            if (idx !== optionIndex) {
              opt.voters = opt.voters.filter(uid => uid !== currentUserId);
            }
          });
        }

        // Toggle vote for the clicked option
        if (hasVotedForThis) {
          updatedOptions[optionIndex].voters = updatedOptions[optionIndex].voters.filter(uid => uid !== currentUserId);
        } else {
          updatedOptions[optionIndex].voters.push(currentUserId);
        }

        transaction.update(messageRef, {
          'pollData.options': updatedOptions
        });
      });
    } catch (err: any) {
      console.error('Failed to vote:', err);
      setErrorMsg(err.message || 'Failed to vote');
      // Revert optimistic update on failure
      setOptimisticPollData(message.pollData);
    }
  };

  return (
    <div className="w-full max-w-[280px] sm:max-w-sm rounded-xl overflow-hidden bg-background border border-border shadow-sm my-1">
      <div className="p-4 border-b border-border bg-surface">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-accent/10 p-1.5 rounded-lg text-accent">
            <BarChart2 className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Poll</span>
        </div>
        <h4 className="text-sm sm:text-base font-semibold text-foreground leading-snug">
          {pollData.question}
        </h4>
        <div className="text-[10px] text-muted-foreground mt-1">
          {pollData.multipleAnswers ? 'Select one or more' : 'Select one'}
        </div>
        {errorMsg && (
          <div className="text-[10px] text-destructive mt-1 font-medium">
            Error: {errorMsg}
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        {pollData.options.map((option) => {
          const hasVoted = option.voters.includes(currentUserId);
          const voteCount = option.voters.length;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

          return (
            <button
              key={option.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleVote(option.id);
              }}
              disabled={pollData.isClosed}
              className={`relative w-full text-left overflow-hidden rounded-lg border transition-all duration-200 group
                ${hasVoted 
                  ? 'border-accent bg-accent/5' 
                  : 'border-border bg-surface hover:border-muted-foreground/30 hover:bg-surface-hover'
                }
                ${pollData.isClosed ? 'opacity-80 cursor-default' : 'cursor-pointer active:scale-[0.98]'}
              `}
            >
              {/* Progress Bar Background */}
              <div 
                className={`absolute inset-y-0 left-0 transition-all duration-500 ease-out ${hasVoted ? 'bg-accent/20' : 'bg-muted/10'}`}
                style={{ width: `${percentage}%` }}
              />

              <div className="relative p-2.5 flex items-center justify-between gap-3 min-h-[44px]">
                <div className="flex-1 flex items-center gap-2 pr-2">
                  <div className={`shrink-0 flex items-center justify-center w-4 h-4 rounded-full border ${
                    hasVoted 
                      ? 'bg-accent border-accent text-white' 
                      : 'border-muted-foreground/30'
                  }`}>
                    {hasVoted && <Check className="w-3 h-3" strokeWidth={3} />}
                  </div>
                  <span className={`text-sm leading-tight break-words font-medium ${hasVoted ? 'text-foreground' : 'text-foreground/80'}`}>
                    {option.text}
                  </span>
                </div>
                
                {totalVotes > 0 && (
                  <div className="shrink-0 text-right">
                    <div className="text-xs font-semibold text-foreground">
                      {percentage}%
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="px-4 py-2 border-t border-border bg-surface/50 flex justify-between items-center text-xs text-muted-foreground">
        <span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
        {pollData.isClosed && <span className="font-medium text-destructive">Closed</span>}
      </div>
    </div>
  );
}
