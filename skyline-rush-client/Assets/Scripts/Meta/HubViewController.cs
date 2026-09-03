using System;
using UnityEngine;
using UnityEngine.UI;
using SkylineRush.Storage;
using SkylineRush.Networking;

namespace SkylineRush.Meta
{
    public class HubViewController : MonoBehaviour
    {
        [Header("Currency Displays")]
        [SerializeField] private Text chipsLabel;
        [SerializeField] private Text coresLabel;

        [Header("Navigation Buttons")]
        [SerializeField] private Button playButton;
        [SerializeField] private Button shopButton;
        [SerializeField] private Button contractsButton;
        [SerializeField] private Button leaderboardButton;

        public event Action OnPlayRequested;
        public event Action OnShopRequested;
        public event Action OnContractsRequested;
        public event Action OnLeaderboardRequested;

        private void Awake()
        {
            if (playButton != null) playButton.onClick.AddListener(() => OnPlayRequested?.Invoke());
            if (shopButton != null) shopButton.onClick.AddListener(() => OnShopRequested?.Invoke());
            if (contractsButton != null) contractsButton.onClick.AddListener(() => OnContractsRequested?.Invoke());
            if (leaderboardButton != null) leaderboardButton.onClick.AddListener(() => OnLeaderboardRequested?.Invoke());
        }

        public void UpdateBalances(int chips, int cores)
        {
            if (chipsLabel != null) chipsLabel.text = chips.ToString("N0");
            if (coresLabel != null) coresLabel.text = cores.ToString("N0");
        }
    }
}
