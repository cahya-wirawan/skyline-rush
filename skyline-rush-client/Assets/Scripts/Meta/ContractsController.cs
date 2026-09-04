using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using SkylineRush.Networking;

namespace SkylineRush.Meta
{
    /// <summary>
    /// Pure C# state/logic class mirroring the web client's Contracts flow (web/game.js:
    /// openContracts, closeContracts, claimContract). Not a MonoBehaviour — a future thin Canvas
    /// view calls into this and reads its state/events.
    ///
    /// Claiming is idempotent: SkylineRushApiService.ClaimContractAsync always sends a fresh
    /// Idempotency-Key, and the backend performs an atomic conditional update
    /// (`WHERE claimed_at IS NULL`, CLAUDE.md #3), so a duplicate tap or resend can never
    /// double-grant a reward.
    /// </summary>
    public class ContractsController
    {
        private readonly SkylineRushApiService _api;

        public bool IsVisible { get; private set; } = false;
        public bool IsLoading { get; private set; } = false;
        public string ErrorMessage { get; private set; } = null;

        public List<ContractItemDto> DailyContracts { get; private set; } = new List<ContractItemDto>();
        public ContractItemDto WeeklyHeistContract { get; private set; } = null;

        /// <summary>All contracts (daily + weekly heist, if present) in display order, matching game.js's `[...(data.daily||[]), data.weekly_heist]` composition.</summary>
        public List<ContractItemDto> AllContracts
        {
            get
            {
                var all = new List<ContractItemDto>(DailyContracts);
                if (WeeklyHeistContract != null) all.Add(WeeklyHeistContract);
                return all;
            }
        }

        public event Action OnContractsRefreshed;
        public event Action<string> OnLoadFailed;
        public event Action<string, ContractRewardDto> OnClaimed; // (contractId, reward)
        public event Action<string> OnClaimFailed;

        public ContractsController(SkylineRushApiService api)
        {
            _api = api;
        }

        /// <summary>Progress percent 0-100, clamped, guarding against a zero target to avoid a divide-by-zero.</summary>
        public static int ComputeProgressPercent(ContractItemDto contract)
        {
            if (contract == null || contract.target <= 0) return 0;
            int pct = (int)Math.Floor((contract.progress / (double)contract.target) * 100.0);
            return Math.Min(100, Math.Max(0, pct));
        }

        /// <summary>Mirrors game.js's openContracts().</summary>
        public async Task OpenAsync()
        {
            IsVisible = true;
            await RefreshAsync();
        }

        public void Close()
        {
            IsVisible = false;
        }

        public async Task RefreshAsync()
        {
            IsLoading = true;
            ErrorMessage = null;
            try
            {
                var data = await _api.GetActiveContractsAsync();
                DailyContracts = data.daily != null ? new List<ContractItemDto>(data.daily) : new List<ContractItemDto>();
                WeeklyHeistContract = data.weekly_heist;
                OnContractsRefreshed?.Invoke();
            }
            catch (ApiRequestException e)
            {
                ErrorMessage = "Could not load contracts.";
                OnLoadFailed?.Invoke(e.Message);
            }
            finally
            {
                IsLoading = false;
            }
        }

        /// <summary>Mirrors game.js's claimContract(id): claim, then refresh so claimed/progress state reflects the server.</summary>
        public async Task ClaimAsync(string contractId)
        {
            try
            {
                var response = await _api.ClaimContractAsync(contractId);
                OnClaimed?.Invoke(contractId, response.reward);
                await RefreshAsync();
            }
            catch (ApiRequestException e)
            {
                OnClaimFailed?.Invoke(e.Message);
            }
        }
    }
}
