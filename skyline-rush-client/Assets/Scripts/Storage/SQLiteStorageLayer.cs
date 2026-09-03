using System;
using System.Collections.Generic;
using System.IO;

namespace SkylineRush.Storage
{
    public class SQLiteStorageLayer : ISQLiteStore
    {
        private readonly Dictionary<string, string> _store = new Dictionary<string, string>();
        private readonly string _filePath;
        private readonly object _lock = new object();

        public SQLiteStorageLayer(string filePath = null)
        {
            _filePath = filePath;
            LoadFromFile();
        }

        private void LoadFromFile()
        {
            if (string.IsNullOrEmpty(_filePath) || !File.Exists(_filePath)) return;
            try
            {
                lock (_lock)
                {
                    var lines = File.ReadAllLines(_filePath);
                    foreach (var line in lines)
                    {
                        int idx = line.IndexOf('=');
                        if (idx > 0)
                        {
                            string k = line.Substring(0, idx);
                            string v = line.Substring(idx + 1);
                            _store[k] = v;
                        }
                    }
                }
            }
            catch { /* fallback to memory */ }
        }

        private void SaveToFile()
        {
            if (string.IsNullOrEmpty(_filePath)) return;
            try
            {
                lock (_lock)
                {
                    var lines = new List<string>(_store.Count);
                    foreach (var kvp in _store)
                    {
                        lines.Add($"{kvp.Key}={kvp.Value}");
                    }
                    var dir = Path.GetDirectoryName(_filePath);
                    if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                    {
                        Directory.CreateDirectory(dir);
                    }
                    File.WriteAllLines(_filePath, lines);
                }
            }
            catch { /* fallback gracefully */ }
        }

        public void SetString(string key, string value)
        {
            lock (_lock)
            {
                _store[key] = value;
                SaveToFile();
            }
        }

        public string GetString(string key, string defaultValue = null)
        {
            lock (_lock)
            {
                if (_store.TryGetValue(key, out var val))
                {
                    return val;
                }
                return defaultValue;
            }
        }

        public void SetInt(string key, int value)
        {
            SetString(key, value.ToString());
        }

        public int GetInt(string key, int defaultValue = 0)
        {
            string str = GetString(key);
            if (str != null && int.TryParse(str, out var parsed))
            {
                return parsed;
            }
            return defaultValue;
        }

        public void Delete(string key)
        {
            lock (_lock)
            {
                if (_store.Remove(key))
                {
                    SaveToFile();
                }
            }
        }

        public bool Exists(string key)
        {
            lock (_lock)
            {
                return _store.ContainsKey(key);
            }
        }

        public void Clear()
        {
            lock (_lock)
            {
                _store.Clear();
                SaveToFile();
            }
        }
    }
}
