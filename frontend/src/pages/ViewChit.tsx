import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet } from '../lib/wallet/WalletContext';
import { getChitStatus, contributeTx, disburseTx, getRoundContributions, CONTRACT_ID, type ChitStatus } from '../lib/contract/soroban';
import posthog from 'posthog-js';
import { submitFeedback } from '../lib/supabase';

const ViewChit = () => {
  const { id } = useParams<{ id: string }>();
  const { address, kit } = useWallet();
  const [chit, setChit] = useState<ChitStatus | null>(null);
  const [contributions, setContributions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      loadChit();
    }
  }, [id]);

  const loadChit = async () => {
    try {
      setLoading(true);
      const chitId = parseInt(id!);
      const status = await getChitStatus(chitId);
      setChit(status);

      // Fetch actual contributions for current round
      try {
        const roundConts = await getRoundContributions(chitId, status.current_round);
        setContributions(roundConts);
      } catch (e) {
        console.error("Failed to load contributions status", e);
      }

      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load chit details.");
      setLoading(false);
    }
  };

  const handleContribute = async () => {
    if (!address || !kit || !chit) return;
    try {
      setActionLoading(true);
      setError('');
      
      const receipt = await contributeTx(kit, address, chit.id, chit.current_round);
      console.log("Contribute tx finalized on-chain:", receipt);
      
      posthog.capture('contribution_made', { chit_id: chit.id, round: chit.current_round });
      
      alert("Contribution successful on-chain!");
      loadChit(); // refresh
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Contribution failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisburse = async () => {
    if (!address || !kit || !chit) return;
    try {
      setActionLoading(true);
      setError('');
      
      const receipt = await disburseTx(kit, address, chit.id, chit.current_round);
      console.log("Disburse tx finalized on-chain:", receipt);
      
      posthog.capture('disbursement_triggered', { chit_id: chit.id, round: chit.current_round });
      
      alert("Disbursement successful! Round advanced on-chain.");
      loadChit(); // refresh
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Disbursement failed.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-12 animate-pulse space-y-6">
        <div className="h-10 bg-gray-200 rounded w-1/3"></div>
        <div className="h-40 bg-gray-200 rounded w-full"></div>
      </div>
    );
  }

  if (!chit) {
    return <div className="text-center py-20">Chit not found</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <Link to="/dashboard" className="text-accent hover:text-accent/80 transition-colors text-sm font-medium mb-2 inline-flex items-center space-x-1">
            <span>&larr;</span> <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-3xl font-bold text-stellar">Group #{chit.id}</h1>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={loadChit}
            disabled={actionLoading}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg font-medium transition-colors text-sm flex items-center space-x-1"
            title="Refresh Group Data"
          >
            <span>🔄</span> <span>Refresh</span>
          </button>
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-medium">
            Round {chit.current_round} of {chit.total_rounds}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-stellar mb-4">Round Info</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Contribution Amount:</span>
              <span className="font-bold">{chit.contribution_amount / 10000000} XLM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Pool:</span>
              <span className="font-bold">{(chit.contribution_amount * chit.members.length) / 10000000} XLM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Recipient this round:</span>
              <span className="font-mono text-accent">{chit.members[(chit.current_round - 1) % chit.members.length].slice(0, 8)}...</span>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
            <button
              onClick={handleContribute}
              disabled={actionLoading || !address || (address ? !!contributions[address] : false)}
              className="w-full bg-accent hover:bg-accent/90 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading ? 'Processing...' : (address && contributions[address] ? 'Already Contributed' : 'Make Contribution')}
            </button>
            <button
              onClick={handleDisburse}
              disabled={actionLoading || !address}
              className="w-full bg-gray-100 hover:bg-gray-200 text-stellar font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              Disburse & Advance Round
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-stellar mb-4">Members</h3>
          <ul className="space-y-3">
            {chit.members.map((m, idx) => {
              const hasPaid = !!contributions[m];
              return (
                <li key={idx} className="flex justify-between items-center text-sm p-2 rounded-lg hover:bg-gray-50">
                  <span className="font-mono text-gray-700">
                    {m.slice(0, 6)}...{m.slice(-4)}
                    {m === address && <span className="ml-2 bg-gray-200 text-xs px-2 py-1 rounded-full">You</span>}
                  </span>
                  <span className={hasPaid ? "text-green-600 font-medium text-xs font-semibold" : "text-amber-500 font-medium text-xs font-semibold"}>
                    {hasPaid ? 'Paid' : 'Pending'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      
      {/* Feedback Widget */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm mt-8">
        <h3 className="text-lg font-bold text-stellar mb-2">How was your experience?</h3>
        <p className="text-sm text-gray-500 mb-4">Help us improve ChitVault by providing your feedback.</p>
        <textarea 
          className="w-full border border-gray-300 rounded-lg p-3 text-sm mb-3 outline-none focus:border-accent"
          placeholder="It was easy to use..."
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          disabled={feedbackSubmitting}
        />
        <button 
          className="bg-stellar text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-stellar/90 disabled:opacity-50"
          onClick={async () => {
            if (!feedback.trim()) return;
            try {
              setFeedbackSubmitting(true);
              await submitFeedback(address || 'Anonymous', feedback);
              posthog.capture('feedback_submitted', { address, feedback });
              alert("Feedback successfully submitted!");
              setFeedback('');
            } catch (e) {
              console.error(e);
              alert("Failed to submit feedback.");
            } finally {
              setFeedbackSubmitting(false);
            }
          }}
          disabled={feedbackSubmitting || !feedback.trim()}
        >
          {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </div>

      <div className="text-center pt-4 border-t border-gray-100 mt-8">
        <a 
          href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors inline-flex items-center space-x-1"
        >
          <span>🌐 Verify Contract on Stellar.Expert</span> <span>↗</span>
        </a>
      </div>
    </div>
  );
};

export default ViewChit;
