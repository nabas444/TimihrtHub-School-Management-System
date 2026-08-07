import api from './api';

// Shared helper for the new Phase 2 PDF endpoints (report cards, receipts, ID
// cards, mark sheets). Fetches through the same authenticated axios instance
// used everywhere else (so the auth header / refresh-token interceptor still
// applies), then triggers a normal browser download.
export async function downloadFile(url, fallbackFileName) {
  const response = await api.get(url, { responseType: 'blob' });

  const disposition = response.headers['content-disposition'];
  const match = disposition && disposition.match(/filename="?([^"]+)"?/);
  const fileName = (match && match[1]) || fallbackFileName;

  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}
