import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Copy,
  Check,
  PlayCircle,
  Code2,
  Send,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { CATEGORIES } from '../constants';
import { EventCategory } from '../types';
import { fetchGoogleScriptCode, submitGoogleFormWebhook } from '../services/api';

interface GoogleFormSetupModalProps {
  onClose: () => void;
  onEventSubmitted?: () => void;
}

export const GoogleFormSetupModal: React.FC<GoogleFormSetupModalProps> = ({
  onClose,
  onEventSubmitted,
}) => {
  const [activeTab, setActiveTab] = useState<'instructions' | 'simulate'>('simulate');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [scriptCode, setScriptCode] = useState<string>('Loading script...');

  // Simulator Form State
  const [simTitle, setSimTitle] = useState('SAKK Member Assembly & Strategic Workshop');
  const [simCategory, setSimCategory] = useState<EventCategory>('SAKK Event');
  const [simDate, setSimDate] = useState('2026-09-23');
  const [simStartTime, setSimStartTime] = useState('14:00');
  const [simEndTime, setSimEndTime] = useState('16:30');
  const [simName, setSimName] = useState('Alex Rivera');
  const [simEmail, setSimEmail] = useState('@alex_rivera');
  const [simLocation, setSimLocation] = useState('Community Hall 3 & Google Meet');
  const [simDesc, setSimDesc] = useState('SAKK collaborative event mapping member initiatives, organizational milestones, and feedback.');
  const [simAttendees, setSimAttendees] = useState('16 participants');
  const [simEquipment, setSimEquipment] = useState('Miro whiteboard, dual monitors');
  const [submitting, setSubmitting] = useState(false);
  const [simulationResult, setSimulationResult] = useState<{ success: boolean; message?: string } | null>(null);

  const webhookUrl = `${window.location.origin}/api/webhooks/google-form`;

  useEffect(() => {
    fetchGoogleScriptCode()
      .then(code => setScriptCode(code))
      .catch(() => setScriptCode(`// Webhook URL:\nconst WEBHOOK_URL = "${webhookUrl}";\n// See instructions tab`));
  }, [webhookUrl]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSimulationResult(null);

    const formattedHandle = simEmail.trim().startsWith('@') || simEmail.includes('@')
      ? simEmail.trim()
      : `@${simEmail.trim()}`;

    try {
      const payload = {
        'Event Title': simTitle,
        'Event Category': CATEGORIES[simCategory]?.label || simCategory,
        'Date': simDate,
        'Start Time': simStartTime,
        'End Time': simEndTime,
        'Preferred Name': simName.trim(),
        'Telegram Handle': formattedHandle,
        'Submitter Name': simName.trim(),
        'Submitter Email': formattedHandle,
        'Location / Meet Link': simLocation.trim(),
        'Description': simDesc.trim(),
        'Estimated Attendees': simAttendees.trim(),
        'Special Equipment': simEquipment.trim(),
      };

      const res = await submitGoogleFormWebhook(payload);
      setSimulationResult({
        success: true,
        message: `Form submitted successfully! Event "${res.event.title}" was queued for immediate administrator approval and broadcast in real-time.`,
      });
      onEventSubmitted?.();
    } catch (err: any) {
      setSimulationResult({
        success: false,
        message: err.message || 'Failed to submit form',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-form-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-emerald-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 id="google-form-modal-title" className="text-base font-bold text-slate-900 leading-tight">
                Google Form Real-Time Integration
              </h2>
              <p className="text-xs text-emerald-900 font-medium">
                Connect your Google Forms to submit events directly into the live calendar
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 bg-slate-50 border-b border-slate-200 flex items-center gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('simulate')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'simulate'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            <span>Interactive Google Form Simulator</span>
          </button>
          <button
            onClick={() => setActiveTab('instructions')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'instructions'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Webhook & Apps Script Setup</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {activeTab === 'simulate' ? (
            <form onSubmit={handleSimulateSubmit} className="space-y-4">
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Test the live submission pipeline immediately:</strong>
                  <p className="mt-0.5 text-emerald-800">
                    Filling out and submitting this simulated Google Form triggers the real webhook endpoint (<code className="bg-emerald-100/80 px-1 rounded font-mono">/api/webhooks/google-form</code>), broadcasts over real-time SSE, notifies the admin for approval, and pushes Telegram alerts.
                  </p>
                </div>
              </div>

              {simulationResult && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-medium border ${
                    simulationResult.success
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      : 'bg-rose-50 text-rose-900 border-rose-300'
                  }`}
                >
                  {simulationResult.message}
                </div>
              )}

              {/* Form inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={simTitle}
                    onChange={(e) => setSimTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="e.g., Annual Design Systems Showcase"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={simCategory}
                    onChange={(e) => setSimCategory(e.target.value as EventCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {Object.values(CATEGORIES).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={simDate}
                    onChange={(e) => setSimDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={simStartTime}
                    onChange={(e) => setSimStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={simEndTime}
                    onChange={(e) => setSimEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Preferred Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={simName}
                    onChange={(e) => setSimName(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Telegram Handle *
                  </label>
                  <input
                    type="text"
                    required
                    value={simEmail}
                    onChange={(e) => setSimEmail(e.target.value)}
                    placeholder="e.g. @alex_rivera"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Location or Virtual Meeting Link *
                  </label>
                  <input
                    type="text"
                    required
                    value={simLocation}
                    onChange={(e) => setSimLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="e.g. Community Hall 3 or https://meet.google.com/abc-defg-hij"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Event Description *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={simDesc}
                    onChange={(e) => setSimDesc(e.target.value)}
                    placeholder="Outline objectives, agendas, or background details..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Estimated Attendees <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={simAttendees}
                    onChange={(e) => setSimAttendees(e.target.value)}
                    placeholder="e.g. 16 participants"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Special Equipment Needs <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={simEquipment}
                    onChange={(e) => setSimEquipment(e.target.value)}
                    placeholder="e.g. Miro whiteboard, dual monitors"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Submitting...' : 'Submit Google Form Response'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Step 1: Webhook URL */}
              <div className="space-y-1.5">
                <div className="font-bold text-slate-800">Step 1: Your Application Webhook URL</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs text-slate-800 select-all"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="inline-flex items-center gap-1 px-3 py-2 font-semibold text-xs bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copied' : 'Copy URL'}</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Google Apps Script instructions */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <div className="font-bold text-slate-800">Step 2: Add Apps Script in your Google Form</div>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                  <li>Open your Google Form at <a href="https://forms.google.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-0.5">Google Forms <ExternalLink className="w-2.5 h-2.5" /></a></li>
                  <li>Click the <strong>3 dots (More)</strong> at top-right &rarr; select <strong>Script editor</strong></li>
                  <li>Paste the pre-configured script below into <code className="bg-slate-100 px-1 rounded font-mono">Code.gs</code></li>
                  <li>Click <strong>Triggers</strong> (clock icon on left) &rarr; <strong>+ Add Trigger</strong>:
                    <ul className="list-disc list-inside pl-4 mt-0.5 space-y-0.5 text-slate-500">
                      <li>Choose which function to run: <code className="font-mono">onFormSubmit</code></li>
                      <li>Select event source: <code className="font-mono">From form</code></li>
                      <li>Select event type: <code className="font-mono">On form submit</code></li>
                    </ul>
                  </li>
                  <li>Click <strong>Save</strong>. Every form response will now hit this live calendar!</li>
                </ol>
              </div>

              {/* Step 3: Copyable Code */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Ready-to-Use Google Apps Script Code</span>
                  <button
                    onClick={handleCopyScript}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-md"
                  >
                    {copiedScript ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedScript ? 'Copied to Clipboard' : 'Copy Script'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-56 leading-normal">
                  {scriptCode}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
