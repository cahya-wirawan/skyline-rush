using System;
using SkylineRush.Run;

namespace SkylineRush.Meta
{
    public class RunHudController
    {
        public int DisplayedMeters { get; private set; } = 0;
        public int DisplayedChips { get; private set; } = 0;
        public int DisplayedScore { get; private set; } = 0;
        public bool IsShieldIndicatorActive { get; private set; } = false;
        public float ChipMultiplierTimer { get; private set; } = 0f;

        public void UpdateHud(RunSession session)
        {
            DisplayedMeters = (int)session.DistanceMeters;
            DisplayedChips = session.ChipsCollected;
            DisplayedScore = session.Score;

            IsShieldIndicatorActive = session.PowerUps.IsShieldActive;

            if (session.PowerUps.ActivePowerUps.TryGetValue(PowerUpType.ChipMultiplier, out var cm))
            {
                ChipMultiplierTimer = cm.RemainingDuration;
            }
            else
            {
                ChipMultiplierTimer = 0f;
            }
        }
    }

    public class RunSummaryController
    {
        public int FinalMeters { get; private set; }
        public int FinalChips { get; private set; }
        public int TotalScore { get; private set; }
        public bool IsSyncPending { get; private set; } = true;
        public string StatusMessage { get; private set; }

        public void PresentSummary(int meters, int chips, bool isOffline)
        {
            FinalMeters = meters;
            FinalChips = chips;
            TotalScore = meters + chips;
            IsSyncPending = isOffline;
            StatusMessage = isOffline ? "Offline - rewards saved to local outbox" : "Synced with Skyline Rush servers";
        }

        public void MarkSynced()
        {
            IsSyncPending = false;
            StatusMessage = "Synced with Skyline Rush servers";
        }
    }

    /// <summary>
    /// Cached last-known Hub currency/state values (renamed from the original "HubController" to
    /// avoid a name collision with the MonoBehaviour Meta/HubViewController.cs now that this file
    /// sits alongside 8+ other `*Controller` classes in the SkylineRush.Meta namespace).
    /// </summary>
    public class HubStateCache
    {
        public int CachedChips { get; set; } = 0;
        public int CachedCores { get; set; } = 0;
        public bool IsOffline { get; set; } = false;
        public string ActiveDistrict { get; set; } = "neo-marina";

        public void RefreshFromCache(int chips, int cores, bool offline)
        {
            CachedChips = chips;
            CachedCores = cores;
            IsOffline = offline;
        }
    }
}
