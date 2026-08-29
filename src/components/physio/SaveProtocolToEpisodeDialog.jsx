import React, { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, ChevronLeft, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { buildManagementProtocolEntry } from '@/lib/physio/careEpisode';
import {
  clientPickerDisplayName,
  filterClientPickerRows,
  loadAccessibleClientPickerRows,
} from '@/lib/protocolClientPicker';

const displayDate = (value) => value
  ? new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  : 'Not recorded';

export default function SaveProtocolToEpisodeDialog({
  isOpen,
  onClose,
  protocolData,
  conditionName,
  provenance,
  category,
  sourceProtocolId,
  droppedPaths,
}) {
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savingEpisodeId, setSavingEpisodeId] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    setSelectedClient(null);
    setEpisodes([]);
    setSearchTerm('');
    setIsLoading(true);
    loadAccessibleClientPickerRows(base44.entities.Client)
      .then((rows) => {
        if (active) setClients(rows);
      })
      .catch((error) => {
        console.error('Failed to load patients for protocol import:', error);
        toast.error('Patients could not be loaded.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [isOpen]);

  const filteredClients = useMemo(
    () => filterClientPickerRows(clients, searchTerm),
    [clients, searchTerm],
  );

  const selectClient = async (client) => {
    setSelectedClient(client);
    setEpisodes([]);
    setIsLoading(true);
    try {
      const rows = await base44.entities.PhysioCareEpisode.filter({
        org_id: client.org_id,
        client_id: client.id,
      });
      setEpisodes((rows || [])
        .filter((episode) => !['discharged', 'cancelled'].includes(episode.status))
        .sort((left, right) => Number(right.episode_number || 0) - Number(left.episode_number || 0)));
    } catch (error) {
      console.error('Failed to load care episodes for protocol import:', error);
      toast.error('Care episodes could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveToEpisode = async (episode) => {
    if (!episode?.id || !episode.updated_date) {
      toast.error('Reload this care episode before saving the protocol.');
      return;
    }
    setSavingEpisodeId(episode.id);
    try {
      const entry = buildManagementProtocolEntry({
        conditionName,
        protocolData,
        provenance,
        category,
        sourceProtocolId,
        droppedPaths,
      });
      await base44.entities.PhysioCareEpisode.update(episode.id, {
        management_protocols: [...(episode.management_protocols || []), entry],
        expected_updated_date: episode.updated_date,
      });
      toast.success(`${conditionName} was saved to ${clientPickerDisplayName(selectedClient)}'s care episode.`);
      onClose();
    } catch (error) {
      console.error('Failed to save protocol to care episode:', error);
      const message = String(error?.message || '').toLowerCase().includes('changed')
        ? 'The care episode changed. Reopen this dialog and try again.'
        : 'The protocol could not be saved to the care episode.';
      toast.error(message);
    } finally {
      setSavingEpisodeId('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-teal-700" />
            Save protocol to care episode
          </DialogTitle>
          <DialogDescription>
            Retain the exact {conditionName} protocol you reviewed inside the patient&apos;s active episode.
          </DialogDescription>
        </DialogHeader>

        {selectedClient ? (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedClient(null); setEpisodes([]); }}>
              <ChevronLeft className="mr-1.5 h-4 w-4" />Choose another patient
            </Button>
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
              <p className="font-semibold text-slate-900">{clientPickerDisplayName(selectedClient)}</p>
              <p className="text-sm text-slate-600">Select an active care episode.</p>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-teal-700" /></div>
            ) : episodes.length ? (
              <div className="space-y-2">
                {episodes.map((episode) => (
                  <button
                    key={episode.id}
                    type="button"
                    disabled={Boolean(savingEpisodeId)}
                    onClick={() => saveToEpisode(episode)}
                    className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-teal-400 hover:bg-teal-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">Episode {episode.episode_number}: {episode.title || episode.presenting_problem || 'Physiotherapy care'}</p>
                        <p className="mt-1 text-sm text-slate-600">Started {displayDate(episode.episode_start_date)} · {String(episode.status || 'active').replaceAll('_', ' ')}</p>
                      </div>
                      {savingEpisodeId === episode.id && <Loader2 className="h-5 w-5 animate-spin text-teal-700" />}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                This patient has no active care episode. Start or reopen an episode before adding a management protocol.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input aria-label="Search patients" placeholder="Search patients..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="pl-10" />
            </div>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-teal-700" /></div>
            ) : filteredClients.length ? (
              <div className="max-h-[420px] space-y-2 overflow-y-auto">
                {filteredClients.map((client) => (
                  <button key={client.id} type="button" onClick={() => selectClient(client)} className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-teal-400 hover:bg-teal-50">
                    <p className="font-medium text-slate-900">{clientPickerDisplayName(client)}</p>
                    <p className="text-sm text-slate-600">{client.email || 'No email recorded'}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">No accessible patients found.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
