using System;

namespace SkylineRush.Meta
{
    public class RedeployModalController
    {
        public bool IsVisible { get; private set; } = false;
        public int RequiredCoreCost { get; private set; } = 10;
        public bool IsCoreOptionEnabled { get; private set; } = true;
        public int ShortfallAmount { get; private set; } = 0;
        public bool IsAdOptionAvailable { get; private set; } = true;

        public event Action OnAdRedeploySelected;
        public event Action<int> OnCoreRedeploySelected;
        public event Action OnRedeployDeclined;

        public void Present(int currentCoreBalance, int previousCoreRedeployCount, bool adAlreadyUsed)
        {
            IsVisible = true;

            // AC-002: Escalating cost: 10 -> 20 -> 40 (capped at 40)
            if (previousCoreRedeployCount == 0) RequiredCoreCost = 10;
            else if (previousCoreRedeployCount == 1) RequiredCoreCost = 20;
            else RequiredCoreCost = 40;

            // AC-002: Free rewarded ad option (1 free per run)
            IsAdOptionAvailable = !adAlreadyUsed;

            // AC-002: Given a player's Core balance is below the displayed cost,
            // then the Core-spend option is visibly disabled with the shortfall amount shown, not hidden.
            if (currentCoreBalance < RequiredCoreCost)
            {
                IsCoreOptionEnabled = false;
                ShortfallAmount = RequiredCoreCost - currentCoreBalance;
            }
            else
            {
                IsCoreOptionEnabled = true;
                ShortfallAmount = 0;
            }
        }

        public void SelectAdRedeploy()
        {
            if (!IsVisible || !IsAdOptionAvailable) return;
            IsVisible = false;
            OnAdRedeploySelected?.Invoke();
        }

        public void SelectCoreRedeploy()
        {
            if (!IsVisible || !IsCoreOptionEnabled) return;
            IsVisible = false;
            OnCoreRedeploySelected?.Invoke(RequiredCoreCost);
        }

        public void DeclineRedeploy()
        {
            if (!IsVisible) return;
            IsVisible = false;
            OnRedeployDeclined?.Invoke();
        }
    }
}
