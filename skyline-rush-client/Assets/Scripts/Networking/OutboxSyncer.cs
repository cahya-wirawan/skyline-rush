using System;
using System.Threading.Tasks;
using SkylineRush.Storage;

namespace SkylineRush.Networking
{
    public class OutboxSyncer
    {
        private readonly OutboxQueue _queue;
        private readonly ApiClient _apiClient;
        private readonly ISQLiteStore _storage;

        public bool IsSyncing { get; private set; } = false;

        public event Action<OutboxEntry> OnEntrySynced;
        public event Action<OutboxEntry, int> OnEntryFailed;
        public event Action<OutboxEntry, int> OnEntryDeadLettered;
        public event Action OnAllSynced;

        public OutboxSyncer(OutboxQueue queue, ApiClient apiClient, ISQLiteStore storage)
        {
            _queue = queue;
            _apiClient = apiClient;
            _storage = storage;
        }

        public async Task<int> FlushQueueAsync()
        {
            if (IsSyncing) return 0;
            IsSyncing = true;

            int syncedCount = 0;

            try
            {
                while (_queue.Count > 0)
                {
                    var entry = _queue.PeekNext();
                    if (entry == null) break;

                    var response = await _apiClient.PostAsync(entry.Endpoint, entry.JsonPayload, entry.IdempotencyKey);

                    if (response.IsSuccess)
                    {
                        _queue.Dequeue(entry.IdempotencyKey);
                        syncedCount++;
                        OnEntrySynced?.Invoke(entry);

                        // If the synced endpoint was a run submission, mark local run as synced
                        if (entry.Endpoint.Contains("/runs"))
                        {
                            _storage.SetString($"run_synced_{entry.IdempotencyKey}", "true");
                        }
                    }
                    else if (response.StatusCode == 409)
                    {
                        // Idempotency duplicate or already resolved: safe to dequeue
                        _queue.Dequeue(entry.IdempotencyKey);
                        syncedCount++;
                        OnEntrySynced?.Invoke(entry);
                    }
                    else if (response.StatusCode >= 400 && response.StatusCode < 500 && response.StatusCode != 429)
                    {
                        // CRIT-05: Terminal 4xx client errors (400, 402, 403, 404, etc.)
                        // Dequeue to prevent FIFO deadlock, fire OnEntryDeadLettered, and record in storage
                        _queue.Dequeue(entry.IdempotencyKey);
                        OnEntryDeadLettered?.Invoke(entry, response.StatusCode);
                        _storage.SetString($"dead_letter_{entry.IdempotencyKey}", response.StatusCode.ToString());
                    }
                    else
                    {
                        // Transient network or server error (e.g. 5xx, 429 rate limit): stop FIFO flush to preserve order
                        entry.RetryCount++;
                        OnEntryFailed?.Invoke(entry, response.StatusCode);
                        break;
                    }
                }

                if (_queue.Count == 0)
                {
                    OnAllSynced?.Invoke();
                }
            }
            finally
            {
                IsSyncing = false;
            }

            return syncedCount;
        }
    }
}
