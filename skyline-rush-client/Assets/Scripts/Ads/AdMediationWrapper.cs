using System;

namespace SkylineRush.Ads
{
    public class AdMediationWrapper
    {
        public bool IsInitialized { get; private set; } = false;
        public bool PersonalizationAllowed { get; private set; } = false;
        public string AgeBucket { get; private set; } = null;

        public event Action<string> OnRewardedAdCompleted;
        public event Action<string> OnRewardedAdFailed;

        public void InitializeWithServerConsent(string ageBucket, bool serverAdPersonalizationAllowed)
        {
            AgeBucket = ageBucket;

            // AC-009 & AC-016: Server-enforced age-bucket gating
            // Under 13 and 13-15 must NEVER receive personalized ads regardless of local setting
            if (ageBucket == "under_13" || ageBucket == "13_15")
            {
                PersonalizationAllowed = false;
            }
            else
            {
                PersonalizationAllowed = serverAdPersonalizationAllowed;
            }

            IsInitialized = true;
        }

        public bool CanShowPersonalizedAds()
        {
            if (!IsInitialized) return false;
            if (AgeBucket == "under_13" || AgeBucket == "13_15") return false;
            return PersonalizationAllowed;
        }

        public void ShowRewardedAd(string placementId, Action<bool> onComplete)
        {
            if (!IsInitialized)
            {
                onComplete?.Invoke(false);
                return;
            }

            // Simulate ad viewing and successful completion
            OnRewardedAdCompleted?.Invoke(placementId);
            onComplete?.Invoke(true);
        }
    }
}
