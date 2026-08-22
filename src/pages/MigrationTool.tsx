import { useState } from 'react';
import { ref } from 'firebase/database';
import { db as rtdb } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function MigrationTool() {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<string>('Ready to migrate');
  const [loading, setLoading] = useState(false);


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-surface p-8 rounded-xl shadow-lg max-w-lg w-full text-center mt-8">
        <h2 className="text-2xl font-bold text-foreground mb-4">Step 2: RTDB Object Migration</h2>
        <p className="text-muted-foreground mb-8">
          This script will convert `participants` arrays to objects and generate the `/userConversations` index required for strict security rules.
        </p>
        <button 
          onClick={async () => {
            if (!currentUser) return setStatus('Error: Must be logged in');
            setLoading(true);
            try {
              setStatus('Fetching all conversations from RTDB...');
              const { get } = await import('firebase/database');
              const convosSnap = await get(ref(rtdb, 'conversations'));
              
              let count = 0;
              const updates: Record<string, any> = {};
              
              if (convosSnap.exists()) {
                convosSnap.forEach((childSnap) => {
                  const convId = childSnap.key;
                  let convData = childSnap.val();
                  
                  // Fix nested metadata issue from previous migration if exists
                  if (convData.metadata) {
                    const meta = convData.metadata;
                    delete convData.metadata;
                    convData = { ...convData, ...meta };
                    
                    // We need to overwrite the whole conversation node to flatten it
                    // So we prepare updates for all its fields
                    Object.keys(convData).forEach(key => {
                      if (key !== 'messages') {
                        updates[`conversations/${convId}/${key}`] = convData[key];
                      }
                    });
                    // Nullify the metadata node
                    updates[`conversations/${convId}/metadata`] = null;
                  }
                  
                  let participantsArray: string[] | null = null;
                  
                  if (Array.isArray(convData.participants)) {
                    participantsArray = convData.participants;
                  } else if (convData.participants && typeof convData.participants === 'object') {
                    // Check if Firebase serialized the array as { "0": "uid1", "1": "uid2" }
                    const values = Object.values(convData.participants);
                    if (values.length > 0 && typeof values[0] === 'string') {
                      participantsArray = values as string[];
                    }
                  }

                  if (participantsArray) {
                    console.log(`Migrating conversation: ${convId}`);
                    const newParticipants: Record<string, boolean> = {};

                    participantsArray.forEach((uid: string) => {
                      if (typeof uid === 'string') {
                        newParticipants[uid] = true;
                        // Generate index
                        updates[`userConversations/${uid}/${convId}`] = true;
                      }
                    });

                    updates[`conversations/${convId}/participants`] = newParticipants;
                    count++;
                  } else if (convData.participants && typeof convData.participants === 'object') {
                    // It's already an object { uid: true }, just ensure userConversations index exists
                    Object.keys(convData.participants).forEach((uid: string) => {
                      updates[`userConversations/${uid}/${convId}`] = true;
                    });
                  }
                });
              }
              
              if (Object.keys(updates).length > 0) {
                setStatus(`Applying ${Object.keys(updates).length} updates to RTDB...`);
                const { update } = await import('firebase/database');
                await update(ref(rtdb), updates);
                setStatus(`Migration Step 2 complete! Fixed ${count} conversations and generated indexes.`);
              } else {
                setStatus('No arrays found to migrate. Everything is already an object!');
              }
            } catch (err: any) {
              console.error(err);
              setStatus(`Error: ${err.message}`);
            } finally {
              setLoading(false);
            }
          }} 
          disabled={loading}
          className="bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-medium hover:bg-secondary/90 disabled:opacity-50 w-full mb-6"
        >
          {loading ? 'Processing...' : 'Run RTDB Structure Fix'}
        </button>
        <div className="text-left bg-background/50 p-4 rounded-lg border border-border">
          <p className="text-sm font-mono text-foreground break-words">{status}</p>
        </div>
      </div>
    </div>
  );
}
