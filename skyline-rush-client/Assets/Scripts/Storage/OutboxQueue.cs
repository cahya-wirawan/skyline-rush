using System;
using System.Collections.Generic;

namespace SkylineRush.Storage
{
    public class OutboxEntry
    {
        public long SequenceNumber { get; set; }
        public string IdempotencyKey { get; set; }
        public string Endpoint { get; set; }
        public string HttpMethod { get; set; } = "POST";
        public string JsonPayload { get; set; }
        public bool IsEconomyCritical { get; set; }
        public DateTime CreatedAt { get; set; }
        public int RetryCount { get; set; } = 0;
    }

    public class OutboxQueue
    {
        public const int MaxEntriesCapacity = 500;
        private readonly List<OutboxEntry> _entries = new List<OutboxEntry>();
        private long _nextSequenceNumber = 1;

        public int Count => _entries.Count;
        public bool IsAtCapacity => _entries.Count >= MaxEntriesCapacity;

        public bool Enqueue(string endpoint, string jsonPayload, string idempotencyKey, bool isEconomyCritical = true, string httpMethod = "POST")
        {
            if (_entries.Count >= MaxEntriesCapacity)
            {
                // Drop oldest non-economy critical entry first
                int dropIndex = _entries.FindIndex(e => !e.IsEconomyCritical);
                if (dropIndex != -1)
                {
                    _entries.RemoveAt(dropIndex);
                }
                else if (!isEconomyCritical)
                {
                    // If full of economy entries and new entry is non-critical, discard new entry
                    return false;
                }
                else
                {
                    // Cannot enqueue if strictly capped at 500 critical items
                    return false;
                }
            }

            var entry = new OutboxEntry
            {
                SequenceNumber = _nextSequenceNumber++,
                IdempotencyKey = idempotencyKey ?? Guid.NewGuid().ToString(),
                Endpoint = endpoint,
                HttpMethod = httpMethod,
                JsonPayload = jsonPayload,
                IsEconomyCritical = isEconomyCritical,
                CreatedAt = DateTime.UtcNow
            };

            _entries.Add(entry);
            return true;
        }

        public OutboxEntry PeekNext()
        {
            if (_entries.Count == 0) return null;
            return _entries[0];
        }

        public void Dequeue(string idempotencyKey)
        {
            _entries.RemoveAll(e => e.IdempotencyKey == idempotencyKey);
        }

        public List<OutboxEntry> GetAllEntriesOrdered()
        {
            var copy = new List<OutboxEntry>(_entries);
            copy.Sort((a, b) => a.SequenceNumber.CompareTo(b.SequenceNumber));
            return copy;
        }

        public void Clear()
        {
            _entries.Clear();
            _nextSequenceNumber = 1;
        }
    }
}
