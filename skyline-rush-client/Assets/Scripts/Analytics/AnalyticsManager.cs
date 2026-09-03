using System;
using System.Collections.Generic;

namespace SkylineRush.Analytics
{
    public class AnalyticsManager
    {
        public bool AnalyticsAllowed { get; private set; } = true;
        public string AgeBucket { get; private set; } = "16_plus";
        public List<string> EmittedEvents { get; } = new List<string>();

        public void ConfigureConsent(string ageBucket, bool serverAnalyticsAllowed)
        {
            AgeBucket = ageBucket;
            AnalyticsAllowed = serverAnalyticsAllowed;
        }

        public bool TrackEvent(string eventName, Dictionary<string, object> parameters = null)
        {
            if (!AnalyticsAllowed)
            {
                // Suppressed by privacy consent policy
                return false;
            }

            // Ensure no PII is logged
            if (parameters != null)
            {
                parameters.Remove("birth_year");
                parameters.Remove("email");
                parameters.Remove("real_name");
            }

            EmittedEvents.Add(eventName);
            return true;
        }

        public void Clear()
        {
            EmittedEvents.Clear();
        }
    }
}
