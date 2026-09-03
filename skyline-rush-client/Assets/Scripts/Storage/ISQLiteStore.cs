using System;
using System.Collections.Generic;

namespace SkylineRush.Storage
{
    public interface ISQLiteStore
    {
        void SetString(string key, string value);
        string GetString(string key, string defaultValue = null);

        void SetInt(string key, int value);
        int GetInt(string key, int defaultValue = 0);

        void Delete(string key);
        bool Exists(string key);

        void Clear();
    }
}
