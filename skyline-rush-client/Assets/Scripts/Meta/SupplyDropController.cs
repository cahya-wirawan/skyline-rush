using System;
using System.Threading.Tasks;
using SkylineRush.Networking;

namespace SkylineRush.Meta
{
    /// <summary>
    /// Pure C# state/logic class mirroring the web client's Supply Drop flow (web/game.js:
    /// openSupplyDrops, executeOpenDrop). Not a MonoBehaviour — a future thin Canvas view calls
    /// into this and reads its state.
    ///
    /// CLAUDE.md #6 (Transparent Odds & Fairness): the odds table displayed here is ALWAYS the
    /// object returned by SkylineRushApiService.GetSupplyDropTableAsync — this class holds no
    /// hardcoded probability literals anywhere. Opening a drop is idempotent
    /// (OpenSupplyDropAsync generates a fresh Idempotency-Key per attempt).
    /// </summary>
    public class SupplyDropController
    {
        private readonly SkylineRushApiService _api;

        /// <summary>Default table id, matching game.js's Api.getSupplyDropTable() hardcoded path — this is a table *identifier*, not an odds value, so it doesn't violate the "never hardcode odds" rule.</summary>
        public const string DefaultTableId = "standard-v7";

        public bool IsVisible { get; private set; } = false;
        public bool IsLoadingOdds { get; private set; } = false;
        public string ErrorMessage { get; private set; } = null;

        /// <summary>The server-disclosed odds table. Null until a successful OpenAsync/RefreshOddsAsync call — never populated with client-side literals.</summary>
        public SupplyDropTableResponseDto OddsTable { get; private set; } = null;

        public bool IsOpeningDrop { get; private set; } = false;
        public SupplyDropOpenResultDto LastDropResult { get; private set; } = null;
        public string LastOpenErrorMessage { get; private set; } = null;

        public event Action OnOddsRefreshed;
        public event Action<string> OnOddsLoadFailed;
        public event Action<SupplyDropOpenResultDto> OnDropOpened;
        public event Action<string> OnDropOpenFailed;

        public SupplyDropController(SkylineRushApiService api)
        {
            _api = api;
        }

        /// <summary>Mirrors game.js's openSupplyDrops(): shows the modal, clears the last result, and fetches the disclosed table.</summary>
        public async Task OpenAsync(string tableId = DefaultTableId)
        {
            IsVisible = true;
            LastDropResult = null;
            LastOpenErrorMessage = null;
            await RefreshOddsAsync(tableId);
        }

        public void Close()
        {
            IsVisible = false;
        }

        public async Task RefreshOddsAsync(string tableId = DefaultTableId)
        {
            IsLoadingOdds = true;
            ErrorMessage = null;
            try
            {
                OddsTable = await _api.GetSupplyDropTableAsync(tableId);
                OnOddsRefreshed?.Invoke();
            }
            catch (ApiRequestException e)
            {
                ErrorMessage = $"Disclosed table {tableId}";
                OnOddsLoadFailed?.Invoke(e.Message);
            }
            finally
            {
                IsLoadingOdds = false;
            }
        }

        /// <summary>Mirrors game.js's executeOpenDrop(), which always opens via the "earned" path from the Hub's free-drop button.</summary>
        public async Task OpenDropAsync(string acquiredVia = "earned")
        {
            IsOpeningDrop = true;
            LastOpenErrorMessage = null;
            try
            {
                var response = await _api.OpenSupplyDropAsync(acquiredVia);
                LastDropResult = response.result;
                OnDropOpened?.Invoke(LastDropResult);
            }
            catch (ApiRequestException e)
            {
                LastOpenErrorMessage = e.Message;
                OnDropOpenFailed?.Invoke(LastOpenErrorMessage);
            }
            finally
            {
                IsOpeningDrop = false;
            }
        }
    }
}
