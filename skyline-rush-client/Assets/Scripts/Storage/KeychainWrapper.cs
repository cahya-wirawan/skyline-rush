using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace SkylineRush.Storage
{
    public interface IKeychain
    {
        void SaveSecure(string key, string secret);
        string GetSecure(string key);
        void DeleteSecure(string key);
    }

    public class KeychainWrapper : IKeychain
    {
        private readonly Dictionary<string, string> _secureStore = new Dictionary<string, string>();
        private readonly string _filePath;
        private readonly object _lock = new object();

        public KeychainWrapper(string filePath = null)
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
                        int idx = line.IndexOf(':');
                        if (idx > 0)
                        {
                            string k = line.Substring(0, idx);
                            string encodedVal = line.Substring(idx + 1);
                            string v = Encoding.UTF8.GetString(Convert.FromBase64String(encodedVal));
                            _secureStore[k] = v;
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
                    var lines = new List<string>(_secureStore.Count);
                    foreach (var kvp in _secureStore)
                    {
                        string encodedVal = Convert.ToBase64String(Encoding.UTF8.GetBytes(kvp.Value));
                        lines.Add($"{kvp.Key}:{encodedVal}");
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

        public void SaveSecure(string key, string secret)
        {
            lock (_lock)
            {
                _secureStore[key] = secret;
                SaveToFile();
            }
        }

        public string GetSecure(string key)
        {
            lock (_lock)
            {
                if (_secureStore.TryGetValue(key, out var val))
                {
                    return val;
                }
                return null;
            }
        }

        public void DeleteSecure(string key)
        {
            lock (_lock)
            {
                if (_secureStore.Remove(key))
                {
                    SaveToFile();
                }
            }
        }
    }
}
