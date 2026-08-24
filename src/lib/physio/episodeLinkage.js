export const PHYSIO_EPISODE_LINK_FIELD = 'physio_care_episode_id';

export const PHYSIO_EPISODE_LINKED_ENTITIES = Object.freeze([
  'ClientAssessment',
  'SOAPNote',
  'SavedReport',
  'ClientReport',
  'ClientDocument',
]);

export function normalizeEpisodeId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function episodeLinkedQuery({ clientId, episodeId }) {
  const normalizedClientId = normalizeEpisodeId(clientId);
  const normalizedEpisodeId = normalizeEpisodeId(episodeId);
  if (!normalizedClientId) throw new TypeError('A patient is required for an episode-linked query');
  if (!normalizedEpisodeId) throw new TypeError('A saved care episode is required for an episode-linked query');
  return {
    client_id: normalizedClientId,
    [PHYSIO_EPISODE_LINK_FIELD]: normalizedEpisodeId,
  };
}

export function legacyUnassignedQuery({ clientId }) {
  const normalizedClientId = normalizeEpisodeId(clientId);
  if (!normalizedClientId) throw new TypeError('A patient is required for an unassigned-record query');
  return {
    client_id: normalizedClientId,
    $or: [
      { [PHYSIO_EPISODE_LINK_FIELD]: { $exists: false } },
      { [PHYSIO_EPISODE_LINK_FIELD]: null },
      { [PHYSIO_EPISODE_LINK_FIELD]: '' },
    ],
  };
}

export function withEpisodeLink(payload, episodeId) {
  const normalizedEpisodeId = normalizeEpisodeId(episodeId);
  if (!normalizedEpisodeId) throw new TypeError('A saved care episode is required to link a clinical record');
  return {
    ...(payload || {}),
    [PHYSIO_EPISODE_LINK_FIELD]: normalizedEpisodeId,
  };
}

export function isLegacyUnassignedRecord(record) {
  return !normalizeEpisodeId(record?.[PHYSIO_EPISODE_LINK_FIELD]);
}

export function recordBelongsToEpisode(record, episodeId) {
  const normalizedEpisodeId = normalizeEpisodeId(episodeId);
  return Boolean(normalizedEpisodeId) && normalizeEpisodeId(record?.[PHYSIO_EPISODE_LINK_FIELD]) === normalizedEpisodeId;
}

export function labelLegacyUnassignedRecord(entityName, record) {
  const labels = {
    ClientAssessment: record?.assessment_name || 'Assessment result',
    SOAPNote: record?.note_name || 'SOAP note',
    SavedReport: record?.report_name || 'Saved report',
    ClientReport: record?.report_name || 'Client report',
    ClientDocument: record?.file_name || 'Clinical document',
  };
  return labels[entityName] || 'Clinical record';
}
